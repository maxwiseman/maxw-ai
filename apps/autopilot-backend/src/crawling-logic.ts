import type { Frame, Page } from "puppeteer";
import { sleep } from "bun";
import { z } from "zod";

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { configuration } from "@acme/db/schema";

import type { WSServerMessageSchema } from "./message-schema";
import { runAgentActivity } from "./activity-agent";
import { createStatus } from "./status-update";
import { waitAndClick, waitAndType } from "./utils";

const LOGIN_URL =
  "https://account.activedirectory.windowsazure.com/applications/signin/6be35607-d39b-4ec5-8b6f-bb7ec0fdc57a?tenantId=a2c165ce-3db2-4317-b742-8b26460ec108";

const SELECTORS = {
  ACTIVITY_TITLE: "#activity-title",
  CONTINUE_BUTTON: 'input[value="Continue"]',
  DISPLAY_NAME: "#displayName",
  DUPLICATE_SESSION: ".duplicate-session-main-header",
  EMAIL_INPUT: 'input[type="email"]',
  FOOTNAV_RIGHT: ".footnav.goRight:not(.disabled)",
  FRAME_PROGRESS: "#frameProgress",
  FRAME_RIGHT: ".FrameRight",
  HEADING: '[role="heading"]',
  IFRAME_PREVIEW: "#iFramePreview",
  NEXT_ACTIVITY: 'a[title="Next Activity"]',
  PASSWORD_INPUT: 'input[type="password"]',
  STAGE_FRAME: "#stageFrame",
  SUBMIT_BUTTON: 'input[type="submit"]',
  VIDEO_PAUSE: "li.pause",
  VIDEO_PLAY: "li.play",
} as const;

const TIMEOUTS = {
  DEFAULT: 10_000,
  DUPLICATE_SESSION: 3_000,
  NEXT_ACTIVITY: 5_000,
} as const;

interface AutomationConfig {
  userPage: Page;
  userId: string;
  sendMessage: (data: z.infer<typeof WSServerMessageSchema>) => void;
  signal?: AbortSignal;
  requestInput: (question: string, options?: string[]) => Promise<string>;
}

class EducationalPlatformAutomation {
  private config: typeof configuration.$inferSelect | null = null;

  constructor(private readonly options: AutomationConfig) {}

  async initialize(): Promise<void> {
    this.config = await this.loadUserConfig();
    if (!this.config?.serviceCredentials) {
      createStatus(
        this.options.userId,
        "Configuration error",
        { type: "error", description: "Missing authentication credentials" },
        this.options.sendMessage,
      );
      throw new Error("Missing authentication credentials");
    }

    await this.authenticateUser();
    while (!this.options.signal?.aborted && (await this.processActivity())) {
      await sleep(750);
    }
  }

  private async loadUserConfig() {
    return (
      (await db.query.configuration.findFirst({
        where: eq(configuration.userId, this.options.userId),
      })) ?? null
    );
  }

  private async authenticateUser(): Promise<void> {
    const credentials = this.config?.serviceCredentials;
    if (!credentials) throw new Error("Missing authentication credentials");

    const status = createStatus(
      this.options.userId,
      "Starting authentication",
      { type: "pending", description: "Connecting to the learning platform" },
      this.options.sendMessage,
    );

    await this.options.userPage.goto(LOGIN_URL, {
      timeout: TIMEOUTS.DEFAULT,
      waitUntil: "domcontentloaded",
    });
    await waitAndType(
      this.options.userPage,
      SELECTORS.EMAIL_INPUT,
      credentials.username,
    );
    await waitAndClick(this.options.userPage, SELECTORS.SUBMIT_BUTTON);
    await this.options.userPage.waitForSelector(SELECTORS.DISPLAY_NAME);
    await waitAndType(
      this.options.userPage,
      SELECTORS.PASSWORD_INPUT,
      credentials.password,
    );
    await waitAndClick(this.options.userPage, SELECTORS.SUBMIT_BUTTON);
    await this.options.userPage.waitForNavigation({
      waitUntil: "domcontentloaded",
    });
    await this.options.userPage.waitForSelector(SELECTORS.HEADING);
    await waitAndClick(this.options.userPage, SELECTORS.SUBMIT_BUTTON);
    await this.options.userPage.waitForNavigation({
      waitUntil: "domcontentloaded",
    });

    try {
      await this.options.userPage.waitForSelector(SELECTORS.DUPLICATE_SESSION, {
        timeout: TIMEOUTS.DUPLICATE_SESSION,
      });
      await waitAndClick(this.options.userPage, SELECTORS.CONTINUE_BUTTON);
    } catch {
      // A duplicate-session prompt is optional.
    }

    await waitAndClick(this.options.userPage, SELECTORS.NEXT_ACTIVITY);
    status.update("Authentication complete", {
      type: "success",
      description: "Ready to begin activities",
    });
  }

  private async processActivity(): Promise<boolean> {
    this.throwIfAborted();
    try {
      await waitAndClick(this.options.userPage, SELECTORS.FOOTNAV_RIGHT, {
        timeout: 1_000,
      });
    } catch {
      // The current activity may already be at the correct frame.
    }

    const titleElement = await this.options.userPage
      .waitForSelector(SELECTORS.ACTIVITY_TITLE, {
        timeout: TIMEOUTS.NEXT_ACTIVITY,
      })
      .catch(() => null);
    if (!titleElement) return false;

    const activity = await this.options.userPage.$eval(
      SELECTORS.ACTIVITY_TITLE,
      (element) => (element.textContent ?? "Activity").trim(),
    );
    const status = createStatus(
      this.options.userId,
      `Processing ${activity}`,
      { type: "pending", description: "Inspecting activity content" },
      this.options.sendMessage,
    );

    const frameElement = await this.options.userPage.waitForSelector(
      SELECTORS.STAGE_FRAME,
    );
    const activityFrame = await frameElement?.contentFrame();
    if (!activityFrame) throw new Error("The activity frame was unavailable");

    await this.logProgress(activityFrame);
    if (await this.isVideo(activityFrame)) {
      await this.processVideo(activityFrame, status);
      return true;
    }

    if (!this.config) throw new Error("Configuration was not loaded");
    status.update("Starting browser agent", {
      type: "pending",
      description: "Observing and completing this activity with AI",
    });
    const result = await runAgentActivity({
      activity,
      page: this.options.userPage,
      requestInput: this.options.requestInput,
      settings: this.config,
      signal: this.options.signal,
      userId: this.options.userId,
    });
    status.update(
      result.outcome === "completed"
        ? "Activity completed"
        : "Activity skipped",
      { type: "success", description: result.summary },
    );
    this.config = await this.loadUserConfig();
    return true;
  }

  private async isVideo(frame: Frame): Promise<boolean> {
    await sleep(2_000);
    return frame
      .$eval(
        SELECTORS.IFRAME_PREVIEW,
        (element) => getComputedStyle(element).display === "none",
      )
      .catch(() => false);
  }

  private async processVideo(
    frame: Frame,
    status: ReturnType<typeof createStatus>,
  ): Promise<void> {
    status.update("Playing video", {
      type: "pending",
      description: "Waiting for the required video to finish",
    });
    await frame.waitForSelector(SELECTORS.VIDEO_PAUSE);
    await frame.waitForSelector(SELECTORS.VIDEO_PLAY, { timeout: 0 });
    this.throwIfAborted();
    await sleep(500);
    await frame.click(SELECTORS.FRAME_RIGHT);
    status.update("Video completed", {
      type: "success",
      description: "Moving to the next activity",
    });
  }

  private async logProgress(frame: Frame): Promise<void> {
    const progress = await frame
      .$eval(SELECTORS.FRAME_PROGRESS, (element) =>
        (element.textContent ?? "").trim(),
      )
      .catch(() => "");
    if (progress) console.log(`Activity progress: ${progress}`);
  }

  private throwIfAborted(): void {
    if (this.options.signal?.aborted) throw new Error("Aborted by user");
  }
}

export async function startCrawling(config: AutomationConfig): Promise<void> {
  config.sendMessage({ type: "newState", state: { status: "running" } });
  await new EducationalPlatformAutomation(config).initialize();
}
