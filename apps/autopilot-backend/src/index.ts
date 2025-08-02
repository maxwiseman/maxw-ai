import type { ServerWebSocket } from "bun";
import type { LaunchOptions, Page } from "puppeteer";
import type { TaskFunction } from "puppeteer-cluster/dist/Cluster";
import type { z } from "zod";
import { serve, sleep } from "bun";
import { Cluster } from "puppeteer-cluster";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import type { Session } from "@acme/auth";
import { auth } from "@acme/auth";

import type { WSServerMessageSchema } from "./message-schema";
import { startCrawling } from "./crawling-logic";
import { WSClientMessageSchema } from "./message-schema";
import {
  clearUserStatuses,
  getUserStatuses,
  markPendingStatusesAsError,
} from "./status-update";
import { normalizeWhitespace } from "./utils";

const args = [
  "--no-sandbox",
  "--mute-audio",
  "--disable-setuid-sandbox",
  "--disable-infobars",
  "--window-position=0,0",
  "--autoplay-policy=no-user-gesture-required",
  // "--incognito",
  "--ignore-certifcate-errors",
  "--ignore-certifcate-errors-spki-list",
  '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"',
];

const options: LaunchOptions = {
  args: args,
  headless: process.env.NODE_ENV === "development" ? false : true,
  // userDataDir: "/Users/maxwiseman/Library/Application Support/Google/Chrome",
  // userDataDir: "./tmp",
  protocolTimeout: 1200000,
  executablePath:
    process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : process.platform === "linux"
        ? undefined
        : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
};

const cluster = await Cluster.launch({
  concurrency: Cluster.CONCURRENCY_CONTEXT,
  maxConcurrency: 5, // Limit concurrent users
  timeout: 43200000,
  puppeteerOptions: options,
  puppeteer: puppeteer.use(StealthPlugin()),
  retryLimit: 2, // Retry failed tasks
  retryDelay: 1000, // Wait 1 second between retries
});

console.log("Cluster launched successfully");
await cluster.task((async ({ page, data }) => {
  // Use provided abortController or create a new one
  const abortController = data.abortController ?? new AbortController();
  console.log("Cluster task started for user:", data.userId);

  // Expose the normalizeWhitespace function to the browser context
  await page.exposeFunction("normalizeWhitespace", normalizeWhitespace);
  taskManager.set(data.userId, { page, abortController });

  // Promise that rejects when aborted
  const abortPromise = new Promise<never>((_, reject) => {
    abortController.signal.addEventListener("abort", () => {
      console.log("Task aborted for user:", data.userId);
      reject(new Error("Aborted by user"));
    });
  });

  await page.setViewport({ height: 800, width: 1400 });

  try {
    console.log("Starting crawling process for user:", data.userId);
    await Promise.race([
      startCrawling({
        userPage: page,
        userId: data.userId,
        sendMessage: data.sendMessage,
        signal: abortController.signal,
      }),
      abortPromise,
    ]);
    console.log("Crawling completed successfully for user:", data.userId);
  } catch (error) {
    console.error("Crawling failed for user:", data.userId, error);
    data.sendMessage({ type: "newState", state: { status: "stopped" } });
  } finally {
    // Mark all pending statuses as errors when automation stops
    markPendingStatusesAsError(data.userId, data.sendMessage);

    taskManager.delete(data.userId);
    data.sendMessage({ type: "newState", state: { status: "stopped" } });
  }
}) as TaskFunction<
  {
    userId: string;
    sendMessage: (data: z.infer<typeof WSServerMessageSchema>) => void;
    abortController?: AbortController;
  },
  void
>);

// const browser = await puppeteer.use(StealthPlugin()).launch(options);
// const context = await browser.createBrowserContext({});

const BOUNDARY = "frame_boundary";
const encoder = new TextEncoder();

// Thread-safe task management with proper user isolation
class TaskManager {
  private tasks = new Map<
    string,
    {
      page?: Page;
      sendMessage?: (data: z.infer<typeof WSServerMessageSchema>) => void;
      state?: object;
      messages?: object[];
      abortController?: AbortController;
    }
  >();

  // Thread-safe get operation
  get(userId: string) {
    return this.tasks.get(userId);
  }

  // Thread-safe set operation with proper merging
  set(
    userId: string,
    updates: Partial<NonNullable<ReturnType<typeof this.get>>>,
  ) {
    const existing = this.tasks.get(userId) || {};
    this.tasks.set(userId, { ...existing, ...updates });
  }

  // Thread-safe delete operation
  delete(userId: string) {
    return this.tasks.delete(userId);
  }

  // Check if user has active task
  hasActiveTask(userId: string): boolean {
    const task = this.tasks.get(userId);
    return !!(task?.page ?? task?.abortController);
  }

  // Get all active user IDs
  getActiveUserIds(): string[] {
    return Array.from(this.tasks.keys()).filter((userId) =>
      this.hasActiveTask(userId),
    );
  }
}

const taskManager = new TaskManager();

// Store active websocket connections for heartbeat
const activeConnections = new Map<
  string,
  { ws: ServerWebSocket<WSData>; userId: string }
>();

// Heartbeat interval to keep websocket connections alive
const heartbeatInterval = setInterval(() => {
  activeConnections.forEach(({ ws }, connectionId) => {
    try {
      // Send a simple ping message to keep the connection alive
      ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
    } catch {
      console.log(
        `Failed to send heartbeat to connection ${connectionId}, removing from active connections`,
      );
      activeConnections.delete(connectionId);
    }
  });

  // Log active users periodically
  const activeUsers = taskManager.getActiveUserIds();
  if (activeUsers.length > 0) {
    console.log("Active users:", activeUsers);
  }
}, 30000); // 30 seconds

// Cleanup heartbeat interval on process exit
process.on("SIGINT", () => {
  clearInterval(heartbeatInterval);
  process.exit(0);
});

serve<WSData, {}>({
  port: 8080,
  async fetch(req, server) {
    const url = new URL(req.url);

    const authData = await auth.api.getSession({ headers: req.headers });
    if (!authData?.session) {
      console.error("Unauthorized request");
      return new Response("Unauthorized", { status: 403 });
    }

    console.log("Authenticated as", authData.user.name);

    if (url.pathname === "/ws") {
      server.upgrade(req, { data: { auth: authData } });
    }
    if (url.pathname !== "/mjpeg") {
      return new Response("Not Found", { status: 404 });
    }

    // if (!state[authData.user.id]?.page) {
    //   state[authData.user.id] ??= { page: await context.newPage(), authData };
    //   startCrawling({ userId: authData.user.id, userPage });
    // }

    await sleep(1000);

    // const userPage = state[authData.user.id]!.page!;
    const userPage = taskManager.get(authData.user.id)?.page;

    if (!userPage)
      throw new Error(
        "Couldn't find user page for some reason. This shouldn't have happened.",
      );

    const CdpSession = await userPage.createCDPSession();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // When client disconnects, stop the interval & close stream
        req.signal.addEventListener("abort", () => {
          clearInterval(timer);
          controller.close();
        });

        // Push the first boundary
        controller.enqueue(encoder.encode(`--${BOUNDARY}\r\n`));

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        const timer = setInterval(async () => {
          try {
            // const buf = await userPage.screenshot({
            //   fullPage: true,
            //   captureBeyondViewport: true,
            // });

            const screenshot = await CdpSession.send(
              "Page.captureScreenshot",
            ).catch(() => {
              console.log("Stopping screenshots");
              clearInterval(timer);
            });
            if (!screenshot) return;

            const b64Screenshot = screenshot.data;
            const buffer = Buffer.from(b64Screenshot, "base64");
            controller.enqueue(
              encoder.encode(
                `Content-Type: image/jpeg\r\n` +
                  `Content-Length: ${buffer.byteLength}\r\n\r\n`,
              ),
            );
            controller.enqueue(buffer);
            controller.enqueue(encoder.encode(`\r\n--${BOUNDARY}\r\n`));
          } catch (err) {
            console.error("Failed to take screenshot", err);
          }
        }, 1000);
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
        "Cache-Control": "no-cache, no-store, must-relavidate",
        Connection: "keep-alive",
      },
    });
  },
  websocket: {
    idleTimeout: 12 * 60, // 12 hours in minutes
    open(ws) {
      const data = ws.data;
      const prevTask = taskManager.get(data.auth.user.id);

      function sendMessage(data: z.infer<typeof WSServerMessageSchema>) {
        ws.send(JSON.stringify(data));
      }

      taskManager.set(data.auth.user.id, { sendMessage });

      // Send current automation state if running
      if (prevTask?.page) {
        sendMessage({ type: "newState", state: { status: "running" } });
      } else {
        sendMessage({ type: "newState", state: { status: "stopped" } });
      }

      // Send all accumulated status updates to sync the client
      const userStatuses = getUserStatuses(data.auth.user.id);
      if (userStatuses.length > 0) {
        sendMessage({ type: "statusList", statuses: userStatuses });
      }

      // Add to active connections
      activeConnections.set(data.auth.user.id, {
        ws,
        userId: data.auth.user.id,
      });
    },
    close(ws) {
      const prevTask = taskManager.get(ws.data.auth.user.id);
      if (!prevTask) return;

      taskManager.set(ws.data.auth.user.id, { sendMessage: undefined });

      // Remove from active connections
      activeConnections.delete(ws.data.auth.user.id);
    },
    async message(ws, msg) {
      function sendMessage(data: z.infer<typeof WSServerMessageSchema>) {
        ws.send(JSON.stringify(data));
      }

      const prevTask = taskManager.get(ws.data.auth.user.id);

      const parsedMsg = WSClientMessageSchema.parse(
        await JSON.parse(msg as string),
      );
      if (parsedMsg.type === "start") {
        console.log("Starting crawling for user:", ws.data.auth.user.id);

        // Check if user already has an active task
        if (taskManager.hasActiveTask(ws.data.auth.user.id)) {
          console.log("User already has active task, ignoring start command");
          sendMessage({ type: "newState", state: { status: "running" } });
          return;
        }

        // Clear old status updates when starting a new session
        clearUserStatuses(ws.data.auth.user.id);

        // Send immediate feedback that crawling is starting
        sendMessage({ type: "newState", state: { status: "running" } });

        try {
          console.log("Executing cluster task for user:", ws.data.auth.user.id);
          const result = await cluster.execute({
            userId: ws.data.auth.user.id,
            sendMessage,
          });
          console.log(
            "Cluster task execution completed for user:",
            ws.data.auth.user.id,
            "Result:",
            result,
          );
        } catch (error) {
          console.error(
            "Cluster execution failed for user:",
            ws.data.auth.user.id,
            error,
          );
          sendMessage({ type: "newState", state: { status: "stopped" } });
        }
      }
      if (parsedMsg.type === "stop") {
        if (!prevTask) {
          console.log("No active task found for user:", ws.data.auth.user.id);
          return;
        }

        console.log("Stopping task for user:", ws.data.auth.user.id);

        // Mark all pending statuses as errors when manually stopping
        markPendingStatusesAsError(ws.data.auth.user.id, sendMessage);

        sendMessage({ type: "newState", state: { status: "stopped" } });
        prevTask.abortController?.abort();

        try {
          await prevTask.page?.close();
        } catch (error) {
          console.error(
            "Error closing page for user:",
            ws.data.auth.user.id,
            error,
          );
        }

        // Clean up task entry
        taskManager.delete(ws.data.auth.user.id);
      }
      // if (parsedMsg.type === "start") {
      //   cluster
      //     .close()
      //     .catch(console.error);
      // }

      console.log("received", parsedMsg);
    },
  },
});

console.log("Server started");
console.log("Active users:", taskManager.getActiveUserIds());

export interface WSData {
  auth: Session;
}
