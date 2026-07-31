import type { ServerWebSocket } from "bun";
import type { LaunchOptions, Page } from "puppeteer";
import type { TaskFunction } from "puppeteer-cluster/dist/Cluster";
import type { z } from "zod";
import { serve, sleep } from "bun";
import { Cluster } from "puppeteer-cluster";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import type { WSServerMessageSchema } from "./message-schema";
import { startCrawling } from "./crawling-logic";
import { WSClientMessageSchema } from "./message-schema";
import { notifyControlPlane, startHeartbeat } from "./run-callback";
import {
  clearUserStatuses,
  getUserStatuses,
  markPendingStatusesAsError,
} from "./status-update";
import { normalizeWhitespace } from "./utils";
import { verifyWorkerToken } from "./worker-token";

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
const workerUserId = process.env.AUTOPILOT_USER_ID;
const stopWorkerHeartbeat = workerUserId
  ? startHeartbeat(workerUserId)
  : () => undefined;
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
  let stopReason: "completed" | "error" | "manual" = "completed";
  let stopError: string | undefined;

  try {
    console.log("Starting crawling process for user:", data.userId);
    await Promise.race([
      startCrawling({
        userPage: page,
        userId: data.userId,
        sendMessage: data.sendMessage,
        signal: abortController.signal,
        requestInput: (question, choices) =>
          taskManager.requestInput(
            data.userId,
            question,
            choices,
            abortController.signal,
          ),
      }),
      abortPromise,
    ]);
    console.log("Crawling completed successfully for user:", data.userId);
  } catch (error) {
    stopReason = abortController.signal.aborted ? "manual" : "error";
    stopError = error instanceof Error ? error.message : String(error);
    console.error("Crawling failed for user:", data.userId, error);
    data.sendMessage({ type: "newState", state: { status: "stopped" } });
  } finally {
    taskManager.cancelPendingInput(data.userId);
    // Mark all pending statuses as errors when automation stops
    markPendingStatusesAsError(data.userId, data.sendMessage);

    taskManager.delete(data.userId);
    data.sendMessage({ type: "newState", state: { status: "stopped" } });
    let completionDelivered = false;
    for (let attempt = 0; attempt < 5 && !completionDelivered; attempt += 1) {
      completionDelivered = await notifyControlPlane(data.userId, {
        type: "stopped",
        reason: stopReason,
        error: stopError,
      });
      if (!completionDelivered) await sleep(2 ** attempt * 1_000);
    }
    if (!completionDelivered && process.env.AUTOPILOT_RUN_CALLBACK_URL) {
      console.error(
        "Could not deliver the stop callback; ending the worker so Workflow detects the lost heartbeat",
      );
      stopWorkerHeartbeat();
      setTimeout(() => process.exit(1), 0);
    }
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

  // Store active websocket connections for dynamic message sending
  private activeConnections = new Map<
    string,
    { ws: ServerWebSocket<WSData>; userId: string }
  >();

  private pendingInputs = new Map<
    string,
    {
      request: { id: string; question: string; options?: string[] };
      resolve: (answer: string) => void;
      reject: (error: Error) => void;
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
    const existing = this.tasks.get(userId) ?? {};
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

  // Add active websocket connection
  addConnection(userId: string, ws: ServerWebSocket<WSData>) {
    this.activeConnections.set(userId, { ws, userId });
  }

  // Remove active websocket connection
  removeConnection(userId: string) {
    this.activeConnections.delete(userId);
  }

  // Get current websocket connection for a user
  getConnection(userId: string) {
    return this.activeConnections.get(userId);
  }

  getPendingInput(userId: string) {
    return this.pendingInputs.get(userId)?.request;
  }

  async requestInput(
    userId: string,
    question: string,
    options: string[] | undefined,
    signal: AbortSignal,
  ): Promise<string> {
    if (signal.aborted) throw new Error("Autopilot was stopped");
    if (this.pendingInputs.has(userId)) {
      throw new Error("Autopilot already has an unanswered user question");
    }

    const request = { id: crypto.randomUUID(), question, options };
    const answer = new Promise<string>((resolve, reject) => {
      this.pendingInputs.set(userId, { request, resolve, reject });
      signal.addEventListener(
        "abort",
        () => {
          this.cancelPendingInput(userId);
        },
        { once: true },
      );
    });
    this.sendMessageToUser(userId, { type: "inputRequest", request });
    void notifyControlPlane(userId, {
      type: "input_required",
      question,
    });
    return answer;
  }

  answerInput(userId: string, requestId: string, answer: string): boolean {
    const pending = this.pendingInputs.get(userId);
    if (!pending || pending.request.id !== requestId) return false;
    this.pendingInputs.delete(userId);
    pending.resolve(answer);
    return true;
  }

  cancelPendingInput(userId: string): void {
    const pending = this.pendingInputs.get(userId);
    if (!pending) return;
    this.pendingInputs.delete(userId);
    pending.reject(new Error("Autopilot stopped while waiting for user input"));
  }

  // Send message to current websocket connection for a user
  sendMessageToUser(
    userId: string,
    data: z.infer<typeof WSServerMessageSchema>,
  ) {
    const connection = this.getConnection(userId);
    if (connection) {
      try {
        connection.ws.send(JSON.stringify(data));
      } catch (error) {
        console.error("Failed to send message to user:", userId, error);
        // Remove the connection if it's no longer valid
        this.removeConnection(userId);
      }
    } else {
      console.log(
        "No active connection for user:",
        userId,
        "Message type:",
        data.type,
      );
    }
  }
}

const taskManager = new TaskManager();

// Note: activeConnections are now managed by taskManager

// Heartbeat interval to keep websocket connections alive
const heartbeatInterval = setInterval(() => {
  // Get all active connections from task manager
  const activeUserIds = taskManager.getActiveUserIds();

  activeUserIds.forEach((userId) => {
    const connection = taskManager.getConnection(userId);
    if (connection) {
      try {
        // Send a simple ping message to keep the connection alive
        connection.ws.send(
          JSON.stringify({ type: "ping", timestamp: Date.now() }),
        );
      } catch {
        console.log(
          `Failed to send heartbeat to user ${userId}, removing connection`,
        );
        taskManager.removeConnection(userId);
      }
    }
  });

  // Log active users periodically
  if (activeUserIds.length > 0) {
    console.log("Active users:", activeUserIds);
  }
}, 30000); // 30 seconds

// Cleanup heartbeat interval on process exit
process.on("SIGINT", () => {
  stopWorkerHeartbeat();
  clearInterval(heartbeatInterval);
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopWorkerHeartbeat();
  clearInterval(heartbeatInterval);
});

async function getRequestUserId(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const secret = process.env.AUTOPILOT_WORKER_SECRET;
  if (token && secret) {
    const payload = await verifyWorkerToken(token, secret);
    if (payload && payload.runId === process.env.AUTOPILOT_RUN_ID) {
      return payload.userId;
    }
    return null;
  }

  // Keep cookie authentication available for the existing local VM workflow.
  const { auth } = await import("@acme/auth");
  const authData = await auth.api.getSession({ headers: req.headers });
  return authData?.user.id ?? null;
}

serve<WSData, Record<never, never>>({
  port: Number(process.env.PORT ?? 8080),
  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    const userId = await getRequestUserId(req);
    if (!userId) {
      console.error("Unauthorized request");
      return new Response("Unauthorized", { status: 403 });
    }

    console.log("Authenticated user", userId);

    if (url.pathname === "/ws") {
      if (server.upgrade(req, { data: { userId } })) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
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
    const userPage = taskManager.get(userId)?.page;

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
      const prevTask = taskManager.get(data.userId);

      // Add this connection to the task manager
      taskManager.addConnection(data.userId, ws);

      // Create a sendMessage function that uses the current connection
      const userId = data.userId;
      function sendMessage(data: z.infer<typeof WSServerMessageSchema>) {
        taskManager.sendMessageToUser(userId, data);
      }

      taskManager.set(data.userId, { sendMessage });

      // Send current automation state if running
      if (prevTask?.page) {
        sendMessage({ type: "newState", state: { status: "running" } });
      } else {
        sendMessage({ type: "newState", state: { status: "stopped" } });
      }

      // Send all accumulated status updates to sync the client
      const userStatuses = getUserStatuses(data.userId);
      if (userStatuses.length > 0) {
        sendMessage({ type: "statusList", statuses: userStatuses });
      }
      const pendingInput = taskManager.getPendingInput(data.userId);
      if (pendingInput) {
        sendMessage({ type: "inputRequest", request: pendingInput });
      }

      console.log(
        "New websocket connection established for user:",
        data.userId,
      );
    },
    close(ws) {
      const prevTask = taskManager.get(ws.data.userId);
      if (!prevTask) return;

      taskManager.set(ws.data.userId, { sendMessage: undefined });

      // Remove from active connections
      taskManager.removeConnection(ws.data.userId);

      console.log("Websocket connection closed for user:", ws.data.userId);
    },
    async message(ws, msg) {
      const userId = ws.data.userId;
      function sendMessage(data: z.infer<typeof WSServerMessageSchema>) {
        taskManager.sendMessageToUser(userId, data);
      }

      const prevTask = taskManager.get(ws.data.userId);

      const parsedMsg = WSClientMessageSchema.parse(
        await JSON.parse(msg as string),
      );
      if (parsedMsg.type === "userInput") {
        if (
          !taskManager.answerInput(
            userId,
            parsedMsg.requestId,
            parsedMsg.answer,
          )
        ) {
          console.warn(
            "Ignoring stale user input response",
            parsedMsg.requestId,
          );
        }
        return;
      }
      if (parsedMsg.type === "start") {
        console.log("Starting crawling for user:", ws.data.userId);

        // Check if user already has an active task
        if (taskManager.hasActiveTask(ws.data.userId)) {
          console.log("User already has active task, ignoring start command");
          sendMessage({ type: "newState", state: { status: "running" } });
          return;
        }

        // Clear old status updates when starting a new session
        clearUserStatuses(ws.data.userId);

        // Send immediate feedback that crawling is starting
        sendMessage({ type: "newState", state: { status: "running" } });

        try {
          console.log("Executing cluster task for user:", ws.data.userId);
          await cluster.execute({
            userId: ws.data.userId,
            sendMessage,
          });
          console.log(
            "Cluster task execution completed for user:",
            ws.data.userId,
          );
        } catch (error) {
          console.error(
            "Cluster execution failed for user:",
            ws.data.userId,
            error,
          );
          sendMessage({ type: "newState", state: { status: "stopped" } });
        }
      }
      if (parsedMsg.type === "stop") {
        if (!prevTask) {
          console.log("No active task found for user:", ws.data.userId);
          return;
        }

        console.log("Stopping task for user:", ws.data.userId);

        // Mark all pending statuses as errors when manually stopping
        markPendingStatusesAsError(ws.data.userId, sendMessage);

        sendMessage({ type: "newState", state: { status: "stopped" } });
        prevTask.abortController?.abort();

        try {
          await prevTask.page?.close();
        } catch (error) {
          console.error("Error closing page for user:", ws.data.userId, error);
        }

        // Clean up task entry
        taskManager.delete(ws.data.userId);
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
  userId: string;
}
