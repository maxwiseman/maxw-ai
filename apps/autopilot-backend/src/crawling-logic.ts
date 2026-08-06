import type { Frame, Page } from "puppeteer";
import type { z } from "zod";
import { sleep } from "bun";

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { configuration } from "@acme/db/schema";

import type { ActivityNavigationState } from "./activity-navigation";
import type { WSServerMessageSchema } from "./message-schema";
import { runAgentActivity } from "./activity-agent";
import { didAdvanceActivity } from "./activity-navigation";
import { createStatus } from "./status-update";
import { waitAndClick, waitAndType } from "./utils";

const EDGENUITY_LOGIN_URL =
  "https://auth.edgenuity.com/Login/SAML/Student/KnoxSchoolsTN";
const EDGENUITY_STUDENT_HOST = "student.edgenuity.com";

const SELECTORS = {
  ACTIVITY_TITLE: "#activity-title",
  CLASSLINK_MICROSOFT_BUTTON: "button.microsoft",
  CONTINUE_BUTTON: 'input[value="Continue"]',
  DISPLAY_NAME: "#displayName",
  DUPLICATE_SESSION: ".duplicate-session-main-header",
  EMAIL_INPUT: 'input[type="email"]',
  EXIT_AUDIO_BUTTON: "#btnExitAudio",
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
  AUTHENTICATION: 30_000,
  ACTIVITY_ADVANCE: 20_000,
  ACTIVITY_TRANSITION: 10_000,
  DEFAULT: 10_000,
  DUPLICATE_SESSION: 3_000,
  NEXT_ACTIVITY: 5_000,
} as const;

function logCrawlerEvent(
  event: string,
  details: Record<string, unknown> = {},
): void {
  console.log(
    JSON.stringify({
      event,
      runId: process.env.AUTOPILOT_RUN_ID ?? "local",
      scope: "autopilot-crawler",
      ...details,
    }),
  );
}

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

    await this.options.userPage.goto(EDGENUITY_LOGIN_URL, {
      timeout: TIMEOUTS.DEFAULT,
      waitUntil: "domcontentloaded",
    });
    await this.options.userPage.waitForSelector(
      SELECTORS.CLASSLINK_MICROSOFT_BUTTON,
      { timeout: TIMEOUTS.AUTHENTICATION, visible: true },
    );
    await this.options.userPage.waitForNetworkIdle({
      idleTime: 500,
      timeout: TIMEOUTS.AUTHENTICATION,
    });
    await Promise.all([
      this.options.userPage.waitForSelector(SELECTORS.EMAIL_INPUT, {
        timeout: TIMEOUTS.AUTHENTICATION,
      }),
      this.options.userPage.click(SELECTORS.CLASSLINK_MICROSOFT_BUTTON),
    ]);
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
    await Promise.all([
      this.options.userPage.waitForNavigation({
        waitUntil: "domcontentloaded",
      }),
      waitAndClick(this.options.userPage, SELECTORS.SUBMIT_BUTTON),
    ]);
    await this.options.userPage.waitForSelector(SELECTORS.HEADING);
    await Promise.all([
      this.options.userPage.waitForNavigation({
        waitUntil: "domcontentloaded",
      }),
      waitAndClick(this.options.userPage, SELECTORS.SUBMIT_BUTTON),
    ]);
    await this.options.userPage.waitForFunction(
      (hostname) => window.location.hostname === hostname,
      { timeout: TIMEOUTS.AUTHENTICATION },
      EDGENUITY_STUDENT_HOST,
    );

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
    logCrawlerEvent("activity_processing_started");
    try {
      await waitAndClick(this.options.userPage, SELECTORS.FOOTNAV_RIGHT, {
        timeout: 1_000,
      });
      logCrawlerEvent("initial_footnav_clicked");
    } catch {
      // The current activity may already be at the correct frame.
      logCrawlerEvent("initial_footnav_unavailable");
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
      logCrawlerEvent("activity_classified", { kind: "video" });
      await this.processVideo(activityFrame, status);
      return true;
    }
    logCrawlerEvent("activity_classified", { kind: "agent" });

    if (!this.config) throw new Error("Configuration was not loaded");
    status.update("Starting browser agent", {
      type: "pending",
      description: "Observing and completing this activity with AI",
    });
    const result = await runAgentActivity({
      advanceActivity: () => this.advanceActivity(),
      activity,
      page: this.options.userPage,
      requestInput: this.options.requestInput,
      settings: this.config,
      signal: this.options.signal,
      userId: this.options.userId,
    });
    if (result.outcome === "video") {
      logCrawlerEvent("video_handoff_requested");
      if (await this.isVideo(activityFrame)) {
        logCrawlerEvent("video_handoff_confirmed");
        await this.processVideo(activityFrame, status);
      } else {
        logCrawlerEvent("video_handoff_rejected");
        status.update("Retrying browser agent", {
          type: "pending",
          description: "The reported video was not detected",
        });
      }
      return true;
    }
    status.update(
      result.outcome === "completed"
        ? "Activity completed"
        : "Activity skipped",
      { type: "success", description: result.summary },
    );
    this.config = await this.loadUserConfig();
    return true;
  }

  private async advanceActivity(): Promise<"footnav" | "frame-right"> {
    this.throwIfAborted();
    logCrawlerEvent("advance_requested");
    if (await this.tryAdvanceFootnav()) return "footnav";
    // The activity may need to advance within #stageFrame first.
    logCrawlerEvent("advance_footnav_unavailable");
    this.throwIfAborted();

    const frameElement = await this.options.userPage.waitForSelector(
      SELECTORS.STAGE_FRAME,
    );
    const activityFrame = await frameElement?.contentFrame();
    if (!activityFrame) throw new Error("The activity frame was unavailable");
    const before = await this.getActivityNavigationState(activityFrame);

    const readinessStartedAt = Date.now();
    logCrawlerEvent("frame_right_wait_started", {
      timeoutMs: TIMEOUTS.ACTIVITY_ADVANCE,
    });
    try {
      await activityFrame.waitForFunction(
        (frameRightSelector, exitAudioSelector) => {
          const frameRight = document.querySelector(frameRightSelector);
          if (!(frameRight instanceof HTMLElement)) return false;

          const style = getComputedStyle(frameRight);
          const isVisible =
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            frameRight.getClientRects().length > 0;
          if (!isVisible) return false;

          const exitAudio = document.querySelector(exitAudioSelector);
          const exitAudioStyle =
            exitAudio instanceof HTMLElement
              ? getComputedStyle(exitAudio)
              : null;
          const exitAudioReady =
            exitAudio instanceof HTMLElement &&
            !exitAudio.hidden &&
            exitAudio.getAttribute("aria-hidden") !== "true" &&
            exitAudioStyle?.display !== "none" &&
            exitAudioStyle?.visibility !== "hidden" &&
            Number.parseFloat(exitAudioStyle?.opacity ?? "1") > 0 &&
            exitAudio.getClientRects().length > 0;
          const frameRightIsPulsing = Number.parseFloat(style.opacity) < 1;
          return exitAudioReady || frameRightIsPulsing;
        },
        { signal: this.options.signal, timeout: TIMEOUTS.ACTIVITY_ADVANCE },
        SELECTORS.FRAME_RIGHT,
        SELECTORS.EXIT_AUDIO_BUTTON,
      );
    } catch {
      this.throwIfAborted();
      logCrawlerEvent("frame_right_wait_failed", {
        durationMs: Date.now() - readinessStartedAt,
      });
      if (await this.tryAdvanceFootnav()) {
        logCrawlerEvent("advance_recovered", { control: "footnav" });
        return "footnav";
      }
      throw new Error(
        "The current slide is not ready to advance. Re-enter the question-content iframe and finish its remaining question or submission step. Do not click Go Left, Go Right, FrameLeft, FrameRight, or a Frame-number link; call next_slide again only after all work in the white content area is complete.",
      );
    }
    this.throwIfAborted();
    const readiness = await activityFrame.$eval(
      SELECTORS.FRAME_RIGHT,
      (frameRight) => ({
        exitAudioPresent: Boolean(document.querySelector("#btnExitAudio")),
        exitAudioVisible: (() => {
          const exitAudio = document.querySelector("#btnExitAudio");
          if (!(exitAudio instanceof HTMLElement)) return false;
          const style = getComputedStyle(exitAudio);
          return (
            !exitAudio.hidden &&
            exitAudio.getAttribute("aria-hidden") !== "true" &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number.parseFloat(style.opacity) > 0 &&
            exitAudio.getClientRects().length > 0
          );
        })(),
        opacity: getComputedStyle(frameRight).opacity,
      }),
    );
    logCrawlerEvent("frame_right_ready", {
      durationMs: Date.now() - readinessStartedAt,
      ...readiness,
    });
    await activityFrame.click(SELECTORS.FRAME_RIGHT);
    const after = await this.waitForForwardActivityTransition(before);
    logCrawlerEvent("advance_succeeded", { control: "frame-right" });
    logCrawlerEvent("activity_transition_verified", { before, after });
    return "frame-right";
  }

  private async tryAdvanceFootnav(): Promise<boolean> {
    try {
      await waitAndClick(this.options.userPage, SELECTORS.FOOTNAV_RIGHT, {
        timeout: 1_000,
        visible: true,
      });
      logCrawlerEvent("advance_succeeded", { control: "footnav" });
      return true;
    } catch {
      return false;
    }
  }

  private async getActivityNavigationState(
    activityFrame?: Frame,
  ): Promise<ActivityNavigationState> {
    const frame =
      activityFrame ??
      (await this.options.userPage
        .waitForSelector(SELECTORS.STAGE_FRAME)
        .then((element) => element?.contentFrame()));
    if (!frame) throw new Error("The activity frame was unavailable");

    const progress = await frame
      .$eval(SELECTORS.FRAME_PROGRESS, (element) =>
        (element.textContent ?? "").trim(),
      )
      .catch(() => null);
    const previewSource = await frame
      .$eval(SELECTORS.IFRAME_PREVIEW, (element) =>
        element instanceof HTMLIFrameElement
          ? element.getAttribute("src")
          : null,
      )
      .catch(() => null);
    return { frameUrl: frame.url(), previewSource, progress };
  }

  private async waitForForwardActivityTransition(
    before: ActivityNavigationState,
  ): Promise<ActivityNavigationState> {
    const startedAt = Date.now();
    let last = before;
    while (Date.now() - startedAt < TIMEOUTS.ACTIVITY_TRANSITION) {
      this.throwIfAborted();
      await sleep(250);
      try {
        last = await this.getActivityNavigationState();
        if (didAdvanceActivity(before, last)) return last;
      } catch {
        // The stage frame can detach briefly while the next frame loads.
      }
    }
    logCrawlerEvent("activity_transition_failed", { before, last });
    throw new Error(
      `The activity did not move forward after FrameRight was clicked (before: ${before.progress ?? "unknown"}; after: ${last.progress ?? "unknown"}). Observe the current frame and continue from there.`,
    );
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
    logCrawlerEvent("video_started");
    await frame.waitForSelector(SELECTORS.VIDEO_PLAY, { timeout: 0 });
    logCrawlerEvent("video_finished");
    this.throwIfAborted();
    await sleep(500);
    await this.advanceActivity();
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
    if (progress) logCrawlerEvent("activity_progress", { progress });
  }

  private throwIfAborted(): void {
    if (this.options.signal?.aborted) throw new Error("Aborted by user");
  }
}

export async function startCrawling(config: AutomationConfig): Promise<void> {
  config.sendMessage({ type: "newState", state: { status: "running" } });
  await new EducationalPlatformAutomation(config).initialize();
}
