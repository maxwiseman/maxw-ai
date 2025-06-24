/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import * as fs from "fs/promises";
import type { OpenAIProviderOptions } from "@ai-sdk/openai/internal";
import type { Frame, Page } from "puppeteer";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { sleep } from "bun";
import { Mouse } from "puppeteer";
import { z } from "zod";

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { configuration } from "@acme/db/schema";

import type { WSServerMessageSchema } from "./message-schema";
import { downloadFile, waitAndClick, waitAndType } from "./utils";

// Constants
const LOGIN_URL =
  "https://account.activedirectory.windowsazure.com/applications/signin/6be35607-d39b-4ec5-8b6f-bb7ec0fdc57a?tenantId=a2c165ce-3db2-4317-b742-8b26460ec108";
const TIMEOUTS = {
  DEFAULT: 10000,
  DUPLICATE_SESSION: 3000,
  FRAME_PROGRESS: 3000,
  NAVIGATION_DELAY: 1000,
  AUDIO_BUTTON: 15000,
  VIDEO_COMPLETION: 500,
  FORM_SUBMISSION: 500,
} as const;

const SELECTORS = {
  EMAIL_INPUT: 'input[type="email"]',
  PASSWORD_INPUT: 'input[type="password"]',
  SUBMIT_BUTTON: 'input[type="submit"]',
  DISPLAY_NAME: "#displayName",
  HEADING: '[role="heading"]',
  DUPLICATE_SESSION: ".duplicate-session-main-header",
  CONTINUE_BUTTON: 'input[value="Continue"]',
  NEXT_ACTIVITY: 'a[title="Next Activity"]',
  ACTIVITY_TITLE: "#activity-title",
  STAGE_FRAME: "#stageFrame",
  FRAME_PROGRESS: "#frameProgress",
  IFRAME_PREVIEW: "#iFramePreview",
  FRAME_RIGHT: ".FrameRight",
  FOOTNAV_RIGHT: ".footnav.goRight:not(.disabled)",
  VIDEO_PAUSE: "li.pause",
  VIDEO_PLAY: "li.play",
  PDF_LINKS: "a:has(.icon-doc-pdf)",
  CONTENT_CONTAINER: ".content,.question-container",
  INLINE_FIELD: ".inline-field",
  INVIS_DIV: "#invis-o-div",
  CHECK_BUTTON: "#btnCheck",
  AUDIO_BUTTON: "#btnEntryAudio",
  EXIT_AUDIO_BUTTON: "#btnExitAudio",
  NAV_BUTTON_LIST: "#navBtnList",
  FILE_INPUT: 'input[type="file"]',
  INSTRUCTION_LINK: '.content a[target="_blank"]',
  DRAG_DROP_COLUMNS: ".sbgColumn",
  DRAG_DROP_COLUMN_LABELS: ".catLabel",
  DRAG_DROP_TILES: ".sbgTile",
} as const;

// Types
type InputType =
  | { type: "input" }
  | { type: "textarea" }
  | { type: "checkbox"; label: string }
  | { type: "radio"; label: string }
  | { type: "select"; options: string[] };

export type ActivityType = "Quiz" | "Video" | "Instructions" | "QuickCheck";

interface AutomationConfig {
  userPage: Page;
  userId: string;
  sendMessage: (data: z.infer<typeof WSServerMessageSchema>) => void;
  signal?: AbortSignal;
}

interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Main entry point for the educational platform automation system
 */
export async function startEducationalAutomation(config: AutomationConfig) {
  const { userPage, userId, sendMessage } = config;

  // Notify that automation is starting
  sendMessage({ type: "newState", state: { status: "running" } });

  const automation = new EducationalPlatformAutomation(userPage, userId);
  await automation.initialize();
}

/**
 * Main automation class that handles the educational platform workflow
 */
class EducationalPlatformAutomation {
  constructor(
    private page: Page,
    private userId: string,
  ) {}

  /**
   * Initialize and start the automation process
   */
  async initialize(): Promise<void> {
    const credentials = await this.loadUserCredentials();
    if (!credentials) {
      console.error("Invalid configuration - missing credentials");
      return;
    }

    await this.authenticateUser(credentials);
    await this.startActivityLoop();
  }

  /**
   * Load user credentials from database
   */
  private async loadUserCredentials(): Promise<LoginCredentials | null> {
    const configurationData = await db.query.configuration.findFirst({
      where: eq(configuration.userId, this.userId),
    });

    return configurationData?.serviceCredentials ?? null;
  }

  /**
   * Handle user authentication flow
   */
  private async authenticateUser(credentials: LoginCredentials): Promise<void> {
    const { username, password } = credentials;

    if (!this.page) {
      throw new Error("Browser page not available");
    }

    console.log("Starting authentication process...");

    // Navigate to login page
    await this.page.goto(LOGIN_URL, { timeout: TIMEOUTS.DEFAULT });

    // Enter email and proceed
    await waitAndType(this.page, SELECTORS.EMAIL_INPUT, username);
    await waitAndClick(this.page, SELECTORS.SUBMIT_BUTTON);

    // Wait for password page and enter credentials
    await this.page.waitForSelector(SELECTORS.DISPLAY_NAME);
    await waitAndType(this.page, SELECTORS.PASSWORD_INPUT, password);
    await waitAndClick(this.page, SELECTORS.SUBMIT_BUTTON);

    // Handle multi-step authentication
    await this.page.waitForNavigation();
    console.log("Completing authentication flow...");

    await this.page.waitForSelector(SELECTORS.HEADING);
    await waitAndClick(this.page, SELECTORS.SUBMIT_BUTTON);
    await this.page.waitForNavigation();

    // Handle potential duplicate session
    await this.handleDuplicateSession();

    // Navigate to first activity
    await waitAndClick(this.page, SELECTORS.NEXT_ACTIVITY);
    console.log("Authentication completed successfully");
  }

  /**
   * Handle duplicate session dialog if it appears
   */
  private async handleDuplicateSession(): Promise<void> {
    try {
      await this.page.waitForSelector(SELECTORS.DUPLICATE_SESSION, {
        timeout: TIMEOUTS.DUPLICATE_SESSION,
      });
      console.log("Handling duplicate session...");
      await waitAndClick(this.page, SELECTORS.CONTINUE_BUTTON);
    } catch {
      console.log("No duplicate session detected, continuing...");
    }
  }

  /**
   * Main activity completion loop
   */
  private async startActivityLoop(): Promise<void> {
    await this.processCurrentActivity();
  }

  /**
   * Process the current activity on the page
   */
  async processCurrentActivity(): Promise<void> {
    if (!this.page) throw new Error("Browser page not available");

    // Try to advance to next activity if possible
    try {
      await waitAndClick(this.page, SELECTORS.FOOTNAV_RIGHT, {
        timeout: TIMEOUTS.NAVIGATION_DELAY,
      });
    } catch {
      console.log("No navigation advancement available");
    }

    // Get activity information
    await this.page.waitForSelector(SELECTORS.ACTIVITY_TITLE);
    const activityType = await this.page.$eval(
      SELECTORS.ACTIVITY_TITLE,
      (element) => element.textContent?.trim() ?? "",
    );

    console.log(`Processing activity type: ${activityType}`);

    // Get activity frame
    const frameElement = await this.page.waitForSelector(SELECTORS.STAGE_FRAME);
    const activityFrame = await frameElement?.contentFrame();
    if (!activityFrame) return;

    // Try to advance frame if possible
    try {
      await waitAndClick(activityFrame, SELECTORS.FRAME_RIGHT);
    } catch {
      console.log("Frame not ready for advancement");
    }

    // Log activity progress if available
    await this.logActivityProgress(activityFrame);

    // Handle different activity types
    if (activityType === "Quiz") {
      console.log("Quiz detected - skipping automatic completion");
      return;
    }

    await this.handleActivityContent(activityFrame);
  }

  /**
   * Log the current activity progress
   */
  private async logActivityProgress(frame: Frame): Promise<void> {
    try {
      await frame.waitForSelector(SELECTORS.FRAME_PROGRESS, {
        timeout: TIMEOUTS.FRAME_PROGRESS,
      });
      const progress = await frame.$eval(SELECTORS.FRAME_PROGRESS, (element) =>
        element.textContent?.trim(),
      );
      console.log(`Activity progress: ${progress}`);
    } catch {
      console.log("Activity progress not available");
    }
  }

  /**
   * Determine and handle the appropriate activity type
   */
  private async handleActivityContent(activityFrame: Frame): Promise<void> {
    // Wait for content to load
    await sleep(2000);

    // Check if this is a video activity
    const isVideo = await activityFrame
      .$eval(
        SELECTORS.IFRAME_PREVIEW,
        (element) => getComputedStyle(element).display === "none",
      )
      .catch(() => false);

    if (isVideo) {
      await this.processVideoActivity(activityFrame);
      return;
    }

    // Check if this is a file-based instruction activity
    const hasFileUpload = !!(await activityFrame.$(SELECTORS.FILE_INPUT));
    if (hasFileUpload) {
      await this.processFileInstructionActivity(activityFrame);
      return;
    }

    // Default to interactive question activity
    await this.processInteractiveQuestionActivity(activityFrame);
  }

  /**
   * Handle video-based activities
   */
  private async processVideoActivity(activityFrame: Frame): Promise<void> {
    console.log("Processing video activity...");

    // Wait for video to start (pause button appears)
    await activityFrame.waitForSelector(SELECTORS.VIDEO_PAUSE);
    console.log("Video playback detected");

    // Wait for video to complete (play button reappears)
    await activityFrame.waitForSelector(SELECTORS.VIDEO_PLAY, { timeout: 0 });
    console.log("Video completed");

    // Brief pause before proceeding
    await sleep(TIMEOUTS.VIDEO_COMPLETION);

    // Advance to next activity
    await activityFrame.click(SELECTORS.FRAME_RIGHT);
    await this.processCurrentActivity();
  }

  /**
   * Handle file-based instruction activities (PDFs, worksheets)
   */
  private async processFileInstructionActivity(
    activityFrame: Frame,
  ): Promise<void> {
    console.log("Processing file instruction activity...");

    // Download instruction files
    const instructionUrls = await activityFrame.$$eval(
      SELECTORS.PDF_LINKS,
      (elements) => elements.map((el) => el.href),
    );

    const instructionFiles = await Promise.all(
      instructionUrls.map(async (url, index) => {
        return downloadFile(url, `./instructions-pt${index}.pdf`);
      }),
    );

    console.log(`Downloaded ${instructionFiles.length} instruction files`);

    // Generate AI response for the worksheet
    const response = await this.generateWorksheetResponse(instructionFiles);

    // Save the response
    await fs.writeFile("./output.md", response);
    console.log("Worksheet response generated and saved");
  }

  /**
   * Generate AI response for worksheet/instruction activities
   */
  private async generateWorksheetResponse(
    instructionFiles: (string | null)[],
  ): Promise<string> {
    const systemPrompt = this.createWorksheetSystemPrompt();

    const output = await generateText({
      model: openai.responses("o4-mini"),
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Answer all parts of this worksheet. You may also be provided with additional resources, but the worksheet or assignment is your main priority. Anything else is purely supplemental.",
            },
            ...instructionFiles.map((data) => ({
              type: "file" as const,
              data: data ?? "",
              mediaType: "application/pdf",
            })),
          ],
        },
      ],
    });

    if (output.warnings) {
      console.log("AI generation warnings:", output.warnings);
    }

    return output.text;
  }

  /**
   * Create system prompt for worksheet completion
   */
  private createWorksheetSystemPrompt(): string {
    return `Answer in standard markdown. Include NO COMMENTARY, only your response itself. THIS IS NOT A CHAT, you are doing WORK! Your entire response will be printed, so DO NOT INCLUDE COMMENTARY AT THE BEGINNING OR THE END. Including something like 'This completes the worksheet' at the bottom invalidates your ENTIRE response. You are a student named ${process.env.user_name} (${process.env.user_role}) located in ${process.env.user_location}. No images will be inserted. Don't use code blocks unless it is actually code. Callouts are not supported. LaTeX is NOT supported. Write any math as plain text. Also, don't put your name on the worksheet.`;
  }

  /**
   * Handle interactive question activities (forms, quizzes)
   */
  private async processInteractiveQuestionActivity(
    activityFrame: Frame,
  ): Promise<void> {
    const questionProcessor = new InteractiveQuestionProcessor(
      activityFrame,
      this.page,
      this,
    );
    await questionProcessor.processQuestions();
  }
}

/**
 * Handles processing of interactive questions and form inputs
 */
class InteractiveQuestionProcessor {
  constructor(
    private activityFrame: Frame,
    private page: Page,
    private automation: EducationalPlatformAutomation,
  ) {}

  /**
   * Main question processing workflow
   */
  async processQuestions(): Promise<void> {
    // Get preview frame
    const previewElement = await this.activityFrame
      .waitForSelector(SELECTORS.IFRAME_PREVIEW)
      .catch(() => undefined);

    const previewFrame =
      (await previewElement?.contentFrame()) ?? this.activityFrame;

    // Clean up invisible divs that might interfere
    await this.cleanupInterfereElements(this.activityFrame);

    // Check if this is a file-based instruction activity
    const hasInstructionLink = !!(await previewFrame.$(
      SELECTORS.INSTRUCTION_LINK,
    ));
    if (hasInstructionLink) {
      console.log("Instruction link detected - skipping automatic completion");
      return;
    }

    // Check if this is a file-based instruction activity
    const hasDragDropColumns = !!(await previewFrame.$(
      SELECTORS.DRAG_DROP_COLUMNS,
    ));
    if (hasDragDropColumns) {
      console.log("Drag drop columns detected - processing...");
      await this.processDragDropColumns();
      return;
    }

    await this.processDefaultQuestion();
  }

  /**
   * Default question processing workflow
   */
  async processDefaultQuestion(): Promise<void> {
    // Get preview frame
    const previewElement = await this.activityFrame
      .waitForSelector(SELECTORS.IFRAME_PREVIEW)
      .catch(() => undefined);

    const previewFrame =
      (await previewElement?.contentFrame()) ?? this.activityFrame;

    console.log("Processing interactive questions...");

    // Check for question content
    const hasQuestions = await previewFrame.waitForSelector(
      SELECTORS.CONTENT_CONTAINER,
    );
    if (!hasQuestions) {
      console.log("No questions found in activity");
      return;
    }

    // Extract question information
    const questionData = await this.extractQuestionData(previewFrame);
    if (!questionData) return;

    const { questionText, inputSchema, questionElement } = questionData;

    // Handle case with no inputs
    if (inputSchema.length === 0) {
      await this.handleNoInputActivity();
      return;
    }

    // Generate and apply answers
    await this.generateAndApplyAnswers(
      questionText,
      inputSchema,
      questionElement,
      previewElement ?? questionElement,
    );

    // Complete the activity
    await this.completeQuestionActivity(previewFrame);
  }

  /**
   * Process drag drop columns
   */
  private async processDragDropColumns(): Promise<void> {
    // Get preview frame
    const previewElement = await this.activityFrame
      .waitForSelector(SELECTORS.IFRAME_PREVIEW)
      .catch(() => undefined);

    const previewFrame =
      (await previewElement?.contentFrame()) ?? this.activityFrame;

    const questionText = await previewFrame.$eval(
      SELECTORS.CONTENT_CONTAINER,
      (item) => item.textContent?.trim() ?? "",
    );

    // Get drag drop column elements and their text content
    // We need to map the label text to the corresponding drop container
    const columnLabelElements = await previewFrame.$$(
      SELECTORS.DRAG_DROP_COLUMN_LABELS,
    );
    const columnTextToElement = new Map<
      string,
      NonNullable<Awaited<ReturnType<Frame["$"]>>>
    >();
    const columnTexts: string[] = [];

    for (const labelElement of columnLabelElements) {
      const text = await labelElement.evaluate(
        (el) => el.textContent?.trim() ?? "",
      );
      if (text) {
        // Find the parent .catColumn and then get the .dropContainer within it
        const dropContainer = await labelElement.evaluateHandle((label) => {
          const catColumn = label.closest(".catColumn");
          return catColumn?.querySelector(".dropContainer");
        });

        const dropElement = dropContainer.asElement() as NonNullable<
          Awaited<ReturnType<Frame["$"]>>
        > | null;
        if (dropElement) {
          columnTextToElement.set(text, dropElement);
          columnTexts.push(text);
        }
      }
    }

    // Get drag drop tile elements and their text content
    const tileElements = await previewFrame.$$(SELECTORS.DRAG_DROP_TILES);
    const tileTextToElement = new Map<
      string,
      NonNullable<Awaited<ReturnType<Frame["$"]>>>
    >();
    const tileTexts: string[] = [];

    for (const element of tileElements) {
      const text = await element.evaluate((el) => el.textContent?.trim() ?? "");
      if (text) {
        tileTextToElement.set(text, element);
        tileTexts.push(text);
      }
    }

    console.log(`Detected columns: ${columnTexts.join(", ")}`);
    console.log(`Detected tiles: ${tileTexts.join(", ")}`);

    const columnEnum = z.enum(columnTexts as [string, ...string[]]);
    const dragDropSchema = z.object(
      Object.fromEntries(tileTexts.map((tile) => [tile, columnEnum])),
    );

    // Take screenshot for AI analysis
    const screenshot = await previewElement?.screenshot({
      path: "./screenshot.png",
    });

    const responses = await generateObject({
      model: openai("o4-mini"),
      schema: dragDropSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Sort the tiles into the correct columns. The question is: ${questionText}`,
            },
            { type: "image", image: screenshot ?? "" },
          ],
        },
      ],
    });

    console.log("Responses:", responses.object);

    // Perform the actual drag and drop operations
    if (previewElement) {
      console.log("Starting drag and drop operations...");

      for (const [tileText, targetColumnText] of Object.entries(
        responses.object,
      )) {
        console.log(
          `Moving tile "${tileText}" to column "${targetColumnText}"`,
        );

        // Get the tile element from our mapping
        const tileElement = tileTextToElement.get(tileText);
        if (!tileElement) {
          console.error(`Could not find tile element: ${tileText}`);
          continue;
        }

        const tileBox = await tileElement.boundingBox();
        if (!tileBox) {
          console.error(`Could not get bounding box for tile: ${tileText}`);
          continue;
        }

        // Get the column element from our mapping
        const columnElement = columnTextToElement.get(targetColumnText);
        if (!columnElement) {
          console.error(`Could not find column element: ${targetColumnText}`);
          continue;
        }

        const columnBox = await columnElement.boundingBox();
        if (!columnBox) {
          console.error(
            `Could not get bounding box for column: ${targetColumnText}`,
          );
          continue;
        }

        // Calculate absolute coordinates using the alternative method
        const tileCoords = await this.calculateDragDropCoordinates(tileElement);
        const columnCoords =
          await this.calculateDragDropCoordinates(columnElement);

        if (!tileCoords) {
          console.error(
            `Could not calculate coordinates for tile: ${tileText}`,
          );
          continue;
        }

        if (!columnCoords) {
          console.error(
            `Could not calculate coordinates for column: ${targetColumnText}`,
          );
          continue;
        }

        // Perform the drag and drop operation using manual mouse events
        try {
          console.log(
            `Dragging from (${tileCoords.x}, ${tileCoords.y}) to (${columnCoords.x}, ${columnCoords.y})`,
          );

          // Move to the tile and press mouse down
          await this.page.mouse.move(tileCoords.x, tileCoords.y);
          await sleep(100);
          await this.page.mouse.down();
          await sleep(200);

          // Drag to the column
          await this.page.mouse.move(columnCoords.x, columnCoords.y, {
            steps: 10,
          });
          await sleep(300);

          // Release the mouse
          await this.page.mouse.up();
          await sleep(200);

          console.log(
            `Successfully dropped tile "${tileText}" into column "${targetColumnText}"`,
          );

          // Brief pause between operations
          await sleep(500);
        } catch (error) {
          console.error(`Failed to drag tile "${tileText}":`, error);
        }
      }

      console.log("Drag and drop operations completed");

      // Complete the activity
      await this.completeQuestionActivity(previewFrame);
    } else {
      console.error("Preview element not found, cannot perform drag and drop");
    }
  }

  /**
   * Alternative method to calculate absolute coordinates by evaluating element position in main page context
   */
  private async calculateDragDropCoordinates(
    element: NonNullable<Awaited<ReturnType<Frame["$"]>>>,
  ): Promise<{ x: number; y: number } | null> {
    try {
      // Use a different approach - get the element's position relative to the viewport
      // and account for any scrolling or transformations
      const rect = await element.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
        };
      });

      // Get the positions of the iframe elements to calculate the nested offset
      const activityFrameElement = await this.page.$(SELECTORS.STAGE_FRAME);
      if (!activityFrameElement) return null;

      const activityFrameRect = await activityFrameElement.evaluate(
        (iframe) => {
          const rect = iframe.getBoundingClientRect();
          return { x: rect.x, y: rect.y };
        },
      );

      // The element's rect is relative to its frame, we need to add the frame's position
      return {
        x: activityFrameRect.x + rect.x + rect.width / 2,
        y: activityFrameRect.y + rect.y + rect.height / 2,
      };
    } catch (error) {
      console.error("Failed to calculate alternative coordinates:", error);
      return null;
    }
  }

  /**
   * Remove interfering elements from the page
   */
  private async cleanupInterfereElements(frame: Frame): Promise<void> {
    await frame
      .$$eval(SELECTORS.INVIS_DIV, (elements) =>
        elements.forEach((item) => item.remove()),
      )
      .catch(() => console.log("No interfering elements found"));
  }

  /**
   * Extract question text and input schema
   */
  private async extractQuestionData(previewFrame: Frame) {
    const questionText = await previewFrame.$eval(
      SELECTORS.CONTENT_CONTAINER,
      (item) => item.textContent?.trim() ?? "",
    );

    // Make inline fields visible
    await previewFrame.$$eval(SELECTORS.INLINE_FIELD, (elements) =>
      elements.forEach((element) => {
        (element as HTMLDivElement).style.overflow = "visible";
      }),
    );

    const questionElement = await previewFrame.$(SELECTORS.CONTENT_CONTAINER);
    if (!questionElement) return null;

    // Analyze input elements and create schema
    const inputSchema = await this.analyzeInputElements(questionElement);

    console.log("Question text:", questionText);
    console.log("Input schema:", inputSchema);

    return { questionText, inputSchema, questionElement };
  }

  /**
   * Analyze input elements on the page and create schema
   */
  private async analyzeInputElements(
    questionElement: NonNullable<Awaited<ReturnType<Frame["$"]>>>,
  ): Promise<InputType[]> {
    return await questionElement.$$eval(
      "input,select,textarea",
      (elements: Element[]) => {
        // Helper function to create numbered visual indicators
        function createNumberDiv(number: number): HTMLDivElement {
          const numberDiv = document.createElement("div");
          numberDiv.textContent = number.toString();
          numberDiv.style.position = "absolute";
          numberDiv.style.display = "inline-block";
          numberDiv.style.aspectRatio = "1";
          numberDiv.style.height = "22px";
          numberDiv.style.background = "hsl(210 70% 65%)";
          numberDiv.style.textAlign = "center";
          numberDiv.style.color = "white";
          numberDiv.style.fontFamily = "monospace";
          numberDiv.style.fontSize = "1.1rem";
          return numberDiv;
        }

        return elements.map((element: Element, i: number) => {
          // Add visual indicators for text inputs, selects, and textareas
          if (
            element.tagName === "SELECT" ||
            element.tagName === "TEXTAREA" ||
            (element.tagName === "INPUT" &&
              (element as HTMLInputElement).type !== "checkbox" &&
              (element as HTMLInputElement).type !== "radio")
          ) {
            const wrapper = document.createElement("span");
            wrapper.style.position = "relative";
            const parent = element.parentNode;
            parent?.insertBefore(wrapper, element);
            wrapper.appendChild(element);
            element.after(createNumberDiv(i));
          }

          // Add identification class
          element.classList.add(`input-id-${i}`);

          // Determine input type and extract relevant data
          if (element.tagName === "SELECT") {
            const options: string[] = [];
            element.childNodes.forEach((childNode) => {
              if (childNode.textContent) {
                options.push(childNode.textContent.trim());
              }
            });
            return { type: "select", options } as InputType;
          }

          if (
            element.tagName === "INPUT" &&
            (element as HTMLInputElement).type === "checkbox"
          ) {
            return {
              type: "checkbox",
              label: element.parentNode?.parentNode?.textContent?.trim() ?? "",
            } as InputType;
          }

          if (
            element.tagName === "INPUT" &&
            (element as HTMLInputElement).type === "radio"
          ) {
            return {
              type: "radio",
              label: element.parentNode?.parentNode?.textContent?.trim() ?? "",
            } as InputType;
          }

          if (element.tagName === "TEXTAREA") {
            return { type: "textarea" } as InputType;
          }

          return { type: "input" } as InputType;
        });
      },
    );
  }

  /**
   * Handle activities with no input elements
   */
  private async handleNoInputActivity(): Promise<void> {
    console.log("No input elements detected - checking for audio content");

    try {
      await this.activityFrame.waitForSelector(SELECTORS.AUDIO_BUTTON, {
        timeout: TIMEOUTS.AUDIO_BUTTON,
        visible: true,
      });
      console.log("Audio content detected");
    } catch {
      console.log("No audio content found");
    }

    console.log("Advancing to next activity");

    // Wait for the button to have opacity less than 100% (indicating it's pulsing/ready)
    await this.activityFrame.waitForFunction(() => {
      const frameRightButton = document.querySelector(".FrameRight");
      if (!frameRightButton) return false;

      const computedStyle = window.getComputedStyle(frameRightButton);
      const opacity = parseFloat(computedStyle.opacity);
      return opacity < 1.0;
    });

    // Click the button once it's in the pulsing state
    await this.activityFrame.click(".FrameRight");
    await this.automation.processCurrentActivity();
  }

  /**
   * Generate AI answers and apply them to form inputs
   */
  private async generateAndApplyAnswers(
    questionText: string,
    inputSchema: InputType[],
    questionElement: NonNullable<Awaited<ReturnType<Frame["$"]>>>,
    previewElement: NonNullable<Awaited<ReturnType<Frame["$"]>>>,
  ): Promise<void> {
    // Create Zod schema for AI response validation
    const zodSchema = this.createResponseSchema(inputSchema);

    // Take screenshot for AI analysis
    const screenshot = await previewElement?.screenshot({
      path: "./screenshot.png",
    });

    // Generate AI response
    const answer = await generateObject({
      model: openai("o4-mini"),
      providerOptions: {
        openai: {
          reasoningEffort: "low",
        } satisfies OpenAIProviderOptions,
      },
      schema: zodSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: this.createQuestionPrompt(questionText),
            },
            {
              type: "image",
              image: screenshot ?? "",
            },
          ],
        },
      ],
    });

    console.log("Generated answers:", answer.object);

    // Apply answers to form elements
    await this.applyAnswersToForm(answer.object, inputSchema, questionElement);
  }

  /**
   * Create Zod schema for AI response validation
   */
  private createResponseSchema(
    inputSchema: InputType[],
  ): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const schemaFields = Object.fromEntries(
      inputSchema.map((val, i) => {
        const key =
          val.type === "checkbox" || val.type === "radio"
            ? val.label.trim()
            : i.toString();

        let zodType;
        if (val.type === "input" || val.type === "textarea") {
          zodType = z.string();
        } else if (val.type === "select") {
          zodType = z.enum(val.options as [string, ...string[]]);
        } else if (val.type === "checkbox" || val.type === "radio") {
          zodType = z.boolean();
        } else {
          zodType = z.string();
        }

        return [key, zodType];
      }),
    );

    return z.object(schemaFields);
  }

  /**
   * Create prompt for AI question answering
   */
  private createQuestionPrompt(questionText: string): string {
    return `Your job is to take the input and answer the question in the blanks. Each blank is labeled with a number, so when you're referencing a specific blank, you can refer to its number.
Only respond with the exact text that should go in that box. If a questions says option ___, only a letter or number should go in the blank, not "option a". That would make it "Option option a", which doesn't make any sense.
Also, if you are given a sample response, DO NOT JUST COPY IT! That would be plagarism, which is unethical. Instead, use it to create a somewhat similar response that covers the same points, while being unique. Basically, if I read your answer, I shouldn't be able to tell you could see the sample.

# Question text: 
${questionText}`;
  }

  /**
   * Apply generated answers to form elements
   */
  private async applyAnswersToForm(
    answers: Record<string, unknown>,
    inputSchema: InputType[],
    questionElement: NonNullable<Awaited<ReturnType<Frame["$"]>>>,
  ): Promise<void> {
    for (const [index, value] of Object.entries(answers)) {
      const schemaValue = inputSchema.find(
        (item, idx) =>
          idx.toString() === index ||
          ((item.type === "checkbox" || item.type === "radio") &&
            item.label === index),
      );

      if (!schemaValue) continue;

      const schemaIndex = inputSchema.indexOf(schemaValue);

      if (typeof value === "string" && schemaValue.type === "select") {
        await this.handleSelectInput(index, value, questionElement);
      } else if (
        schemaValue.type === "checkbox" ||
        schemaValue.type === "radio"
      ) {
        await this.handleCheckboxRadioInput(
          schemaIndex,
          value as boolean,
          questionElement,
        );
      } else if (
        schemaValue.type === "input" ||
        schemaValue.type === "textarea"
      ) {
        await this.handleTextInput(
          schemaIndex,
          schemaValue.type,
          value as string,
          questionElement,
        );
      }
    }
  }

  /**
   * Handle select dropdown inputs
   */
  private async handleSelectInput(
    index: string,
    value: string,
    questionElement: NonNullable<Awaited<ReturnType<Frame["$"]>>>,
  ): Promise<void> {
    const selectElement = await questionElement.$(`select.input-id-${index}`);

    const optionValue = await selectElement
      ?.$$eval(
        "option",
        (optionElements: HTMLOptionElement[], targetValue: string) =>
          optionElements.map((option: HTMLOptionElement) => {
            return option.textContent?.trim() === targetValue.trim()
              ? option.value
              : undefined;
          }),
        value,
      )
      .then((list: (string | undefined)[]) =>
        list.find((item) => item !== undefined && item !== null),
      );

    console.log("Selecting option:", optionValue);
    await selectElement?.select(optionValue ?? "");
  }

  /**
   * Handle checkbox and radio button inputs
   */
  private async handleCheckboxRadioInput(
    index: number,
    value: boolean,
    questionElement: NonNullable<Awaited<ReturnType<Frame["$"]>>>,
  ): Promise<void> {
    const inputElement = await questionElement.$(`input.input-id-${index}`);

    console.log("Setting checkbox/radio:", value);
    if (value === true) {
      await inputElement?.click();
    }
  }

  /**
   * Handle text input and textarea elements
   */
  private async handleTextInput(
    index: number,
    inputType: string,
    value: string,
    questionElement: NonNullable<Awaited<ReturnType<Frame["$"]>>>,
  ): Promise<void> {
    const inputElement = await questionElement.$(
      `${inputType}.input-id-${index}`,
    );

    await inputElement?.type(value);

    if (inputType === "textarea") {
      await this.activityFrame.click(SELECTORS.CHECK_BUTTON);
      await sleep(TIMEOUTS.FORM_SUBMISSION);
    }
  }

  /**
   * Complete the question activity
   */
  private async completeQuestionActivity(previewFrame: Frame): Promise<void> {
    // Check if there are more questions
    if (await previewFrame.$(SELECTORS.NAV_BUTTON_LIST)) {
      await waitAndClick(previewFrame, "nextQuestion");
      await this.automation.processCurrentActivity();
      return;
    }

    // Submit the current activity
    await this.activityFrame.click(SELECTORS.CHECK_BUTTON);
    await this.activityFrame.waitForSelector(SELECTORS.EXIT_AUDIO_BUTTON);
    await this.activityFrame.click(SELECTORS.FRAME_RIGHT);
    await this.automation.processCurrentActivity();
  }
}

// Maintain backward compatibility with the original function name
export async function startCrawling(config: AutomationConfig) {
  return startEducationalAutomation(config);
}
