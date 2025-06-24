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
  timeout: 43200000,
  puppeteerOptions: options,
  puppeteer: puppeteer.use(StealthPlugin()),
});
await cluster.task((async ({ page, data }) => {
  // Use provided abortController or create a new one
  const abortController = data.abortController ?? new AbortController();
  console.log("Page updated");
  const prevTask = tasks.get(data.userId);
  tasks.set(data.userId, { ...prevTask, page, abortController });

  // Promise that resolves when aborted
  const abortPromise = new Promise((resolve) => {
    abortController.signal.addEventListener("abort", () => {
      resolve(new Error("Aborted by user"));
    });
  });

  await page.setViewport({ height: 800, width: 1400 });

  try {
    await Promise.race([
      startCrawling({
        userPage: page,
        userId: data.userId,
        sendMessage: data.sendMessage,
        signal: abortController.signal,
      }),
      abortPromise,
    ]);
  } finally {
    tasks.delete(data.userId);
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

// const state: Record<string, { page: Page | undefined; authData: Session }> = {};
const tasks = new Map<
  string,
  {
    page?: Page;
    // socket?: ServerWebSocket<WSData>;
    sendMessage?: (data: z.infer<typeof WSServerMessageSchema>) => void;
    state?: object;
    messages?: object[];
    abortController?: AbortController;
  }
>();

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
    const userPage = tasks.get(authData.user.id)?.page;

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
    open(ws) {
      const data = ws.data;
      const prevTask = tasks.get(data.auth.user.id);

      function sendMessage(data: z.infer<typeof WSServerMessageSchema>) {
        ws.send(JSON.stringify(data));
      }

      tasks.set(data.auth.user.id, { ...prevTask, sendMessage });

      if (!prevTask) {
        console.log("no previous task");
        return;
      }

      if (prevTask.page)
        sendMessage({ type: "newState", state: { status: "running" } });

      if ((prevTask.messages?.length ?? 0) > 0)
        ws.send(JSON.stringify(prevTask.messages));
    },
    close(ws) {
      const prevTask = tasks.get(ws.data.auth.user.id);
      if (!prevTask) return;

      tasks.set(ws.data.auth.user.id, { ...prevTask, sendMessage: undefined });
    },
    async message(ws, msg) {
      function sendMessage(data: z.infer<typeof WSServerMessageSchema>) {
        ws.send(JSON.stringify(data));
      }

      const prevTask = tasks.get(ws.data.auth.user.id);

      const parsedMsg = WSClientMessageSchema.parse(
        await JSON.parse(msg as string),
      );
      if (parsedMsg.type === "start") {
        cluster
          .execute({
            userId: ws.data.auth.user.id,
            sendMessage,
          })
          .catch(console.error);
      }
      if (parsedMsg.type === "stop") {
        if (!prevTask) return;
        sendMessage({ type: "newState", state: { status: "stopped" } });
        prevTask.abortController?.abort();
        await prevTask.page?.close();
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

export interface WSData {
  auth: Session;
}
