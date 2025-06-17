/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as fs from "fs/promises";
import type { OpenAIProviderOptions } from "@ai-sdk/openai/internal";
import type { ElementHandle, Frame, Page } from "puppeteer";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { sleep } from "bun";
import { z } from "zod";

import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { configuration } from "@acme/db/schema";

import type { WSServerMessageSchema } from "./message-schema";
import { downloadFile, waitAndClick, waitAndType } from "./utils";

export async function startCrawling({
  userPage,
  userId,
  sendMessage,
}: {
  userPage: Page;
  userId: string;
  sendMessage: (data: z.infer<typeof WSServerMessageSchema>) => void;
  signal?: AbortSignal;
}) {
  sendMessage({ type: "newState", state: { status: "running" } });

  const activityCompleter = {
    instruction: async (activityFrame: Frame) => {
      await sleep(2000);
      const isVideo = await activityFrame
        .$eval(
          "#iFramePreview",
          (element) => getComputedStyle(element).display === "none",
        )
        .catch(() => false);
      console.log("isVideo", isVideo);
      if (isVideo) {
        await handleVideoActivity(activityFrame);
      } else {
        console.log("Activity time");
        if (await activityFrame.$('input[type="file"]')) {
          await handleFileInstructions(activityFrame);
        } else {
          await handleQuickCheckActivity(activityFrame);
        }
      }
    },
  };

  async function performLogin({
    username,
    password,
  }: {
    username: string;
    password: string;
  }) {
    if (!userPage) throw new Error("Couldn't find user page");

    // if (
    //   typeof process.env.username !== "string" ||
    //   typeof process.env.password !== "string"
    // ) {
    //   console.error(
    //     "Please add your login credentials to the environment variables file",
    //   );
    //   return;
    // }
    await userPage.goto(
      "https://account.activedirectory.windowsazure.com/applications/signin/6be35607-d39b-4ec5-8b6f-bb7ec0fdc57a?tenantId=a2c165ce-3db2-4317-b742-8b26460ec108",
      { timeout: 10000 },
    );
    await waitAndType(userPage, 'input[type="email"]', username);
    await waitAndClick(userPage, 'input[type="submit"]');
    await userPage.waitForSelector("#displayName");
    await waitAndType(userPage, 'input[type="password"]', password);
    await waitAndClick(userPage, 'input[type="submit"]');
    await userPage.waitForNavigation();
    console.log("Clicking submit again");
    await userPage.waitForSelector('[role="heading"]');
    await waitAndClick(userPage, 'input[type="submit"]');
    await userPage.waitForNavigation();
    try {
      await userPage.waitForSelector(".duplicate-session-main-header", {
        timeout: 3000,
      });
      console.log("Clicking submit");
      await waitAndClick(userPage, 'input[value="Continue"]');
    } catch {
      console.log("No duplicate session, continuing...");
    }
    await waitAndClick(userPage, 'a[title="Next Activity"]');
    console.log("Signed in");
  }

  async function setup() {
    const configurationData = await db.query.configuration.findFirst({
      where: eq(configuration.userId, userId),
    });
    if (!configurationData?.serviceCredentials) {
      console.error("Invalid configuration");
      return "invalid_config";
    }
    await performLogin({ ...configurationData.serviceCredentials });
    await completeActivity();
  }

  async function completeActivity() {
    if (!userPage) throw new Error("Couldn't find user page");

    try {
      await waitAndClick(userPage, ".footnav.goRight:not(.disabled)", {
        timeout: 1000,
      });
    } catch {
      console.log("Activity not completed");
    }
    await userPage.waitForSelector("#activity-title");
    const activityType = await userPage.$eval(
      "#activity-title",
      (item) => item.textContent,
    );
    const frameElement = await userPage.waitForSelector("#stageFrame");
    const activityFrame = await frameElement?.contentFrame();
    if (!activityFrame) return;

    try {
      await waitAndClick(activityFrame, ".FrameRight");
    } catch {
      console.log("Frame not completed");
    }

    try {
      await activityFrame.waitForSelector("#frameProgress", { timeout: 3000 });
      const activityProgress = await activityFrame.$eval(
        "#frameProgress",
        (item) => item.textContent,
      );
      console.log(`Activity progress: ${activityProgress}`);
    } catch {
      console.error("Didn't find activity progress");
    }

    if (activityType == "Quiz") {
      console.log(`Item is a ${activityType}...`);
      return;
    } else {
      await activityCompleter.instruction(activityFrame);
    }
  }

  async function handleVideoActivity(activityFrame: Frame): Promise<void> {
    console.log("Completing video");
    await activityFrame.waitForSelector("li.pause");
    console.log("Detected pause");
    await activityFrame.waitForSelector("li.play", { timeout: 0 });
    console.log("Video finished");
    await sleep(500);
    await activityFrame.click(".FrameRight");
    await completeActivity();
  }

  async function handleFileInstructions(activityFrame: Frame): Promise<void> {
    console.log("Downloading instructions");
    const instructionUrls = await activityFrame.$$eval(
      "a:has(.icon-doc-pdf)",
      (elements) => elements.map((el) => el.href),
    );
    const base64List = await Promise.all(
      instructionUrls.map(async (instructionUrl, i) => {
        return downloadFile(instructionUrl, `./instructions-pt${i}.pdf`);
      }),
    );
    console.log("Files", base64List.length);
    console.log("answering...");
    const output = await generateText({
      // model: perplexity("sonar-deep-research"),
      // model: openai.responses("gpt-4.1-mini"),
      model: openai.responses("o4-mini"),
      // tools: {
      //   web_search_preview: openai.tools.webSearchPreview({
      //     userLocation: {
      //       type: "approximate",
      //       country: "US",
      //       region: process.env.user_state,
      //       city: process.env.user_city,
      //     },
      //   }),
      // },
      messages: [
        {
          role: "system",
          content: `Answer in standard markdown. Include NO COMMENTARY, only your response itself. THIS IS NOT A CHAT, you are doing WORK! Your entire response will be printed, so DO NOT INCLUDE COMMENTARY AT THE BEGINNING OR THE END. Including something like 'This completes the worksheet' at the bottom invalidates your ENTIRE response. You are a student named ${process.env.user_name} (${process.env.user_role}) located in ${process.env.user_location}. No images will be inserted. Don't use code blocks unless it is actually code. Callouts are not supported. LaTeX is NOT supported. Write any math as plain text. Also, don't put your name on the worksheet.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Answer all parts of this worksheet. You may also be provided with additional resources, but the worksheet or assignment is your main priority. Anything else is purely supplemental.",
            },
            ...base64List.map((data) => ({
              type: "file" as const,
              data: data ?? "",
              mediaType: "application/pdf",
            })),
          ],
        },
      ],
    });
    if (output.warnings) console.log("warnings", output.warnings);
    console.log("answered", output.text);
    await fs.writeFile("./output.md", output.text);
    // await markdownToPdf(browser, {
    //   src: output.text,
    //   dest: "./output.pdf",
    // });
  }

  async function handleQuickCheckActivity(activityFrame: Frame): Promise<void> {
    const previewElement = await activityFrame
      .waitForSelector("#iFramePreview")
      .catch(() => undefined);
    const previewFrame =
      (await previewElement?.contentFrame()) ?? activityFrame;
    await activityFrame
      .$$eval("#invis-o-div", (elements) =>
        elements.forEach((item) => item.remove()),
      )
      .catch(() => console.error("No invis-o-div"));
    console.log("Removed invis-o-div");
    if (true) {
      console.log("Detected quick-check");
      if (await previewFrame.waitForSelector(".content,.question-container")) {
        const questionText = await previewFrame.$eval(
          ".content,.question-container",
          (item) => item.textContent,
        );
        await previewFrame.$$eval(".inline-field", (elements) =>
          elements.forEach((element) => {
            (element as HTMLDivElement).style.overflow = "visible";
          }),
        );
        const questionElement = await previewFrame.$(
          ".content,.question-container",
        );

        type InputType =
          | { type: "input" }
          | { type: "textarea" }
          | { type: "checkbox"; label: string }
          | { type: "radio"; label: string }
          | { type: "select"; options: string[] };

        const inputSchema = await questionElement?.$$eval(
          "input,select,textarea",
          (elements) => {
            function createNumberDiv(number: number) {
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
              element.classList.add(`input-id-${i}`);

              if (element.tagName === "SELECT") {
                const options: string[] = [];
                element.childNodes.forEach((childNode) => {
                  if (childNode.textContent)
                    options.push(childNode.textContent?.trim());
                });
                return { type: "select", options } as InputType;
              }
              if (
                element.tagName === "INPUT" &&
                (element as HTMLInputElement).type === "checkbox"
              )
                return {
                  type: "checkbox",
                  label:
                    element.parentNode?.parentNode?.textContent?.trim() ?? "",
                };

              if (
                element.tagName === "INPUT" &&
                (element as HTMLInputElement).type === "radio"
              )
                return {
                  type: "radio",
                  label:
                    element.parentNode?.parentNode?.textContent?.trim() ?? "",
                };
              if (element.tagName === "TEXTAREA")
                return { type: "textarea" } as InputType;
              return { type: "input" } as InputType;
            });
          },
        );

        const screenshot = await previewElement?.screenshot({
          path: "./screenshot.png",
        });

        console.log("Inputs:", inputSchema);
        console.log("Question text:", questionText);

        if (inputSchema?.length === 0) {
          console.error("No inputs detected!");
          try {
            await activityFrame.waitForSelector("#btnEntryAudio", {
              timeout: 15000,
              visible: true,
            });
          } catch {
            console.log("No audio");
          }
          //   await sleep(3000);
          console.log("Clicking next");
          await waitAndClick(
            activityFrame,
            ".FrameRight[style*='opacity:0.5']",
          );
          //   await activityFrame.click(".FrameRight");
          await completeActivity();
          return;
        }

        const zodSchema = z.object(
          Object.fromEntries(
            (inputSchema as InputType[]).map((val, i) => [
              val.type === "checkbox" || val.type === "radio"
                ? val.label.trim()
                : i.toString(),
              val.type == "input" || val.type == "textarea"
                ? z.string()
                : val.type === "select"
                  ? z.enum(val.options as [string, ...string[]])
                  : val.type === "checkbox" || val.type === "radio"
                    ? z.boolean()
                    : z.string(),
            ]),
          ),
        );

        console.log(
          Object.fromEntries(
            (inputSchema as InputType[]).map((val, i) => [
              val.type === "checkbox" || val.type === "radio"
                ? val.label.trim()
                : i.toString(),
              val.type == "input" || val.type == "textarea"
                ? "string"
                : val.type === "select"
                  ? z.enum(val.options as [string, ...string[]])
                  : val.type === "checkbox" || val.type === "radio"
                    ? "boolean"
                    : "string",
            ]),
          ),
        );

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
                  text: `Your job is to take the input and answer the question in the blanks. Each blank is labeled with a number, so when you're referencing a specific blank, you can refer to its number.\nOnly respond with the exact text that should go in that box. If a questions says option ___, only a letter or number should go in the blank, not "option a". That would make it "Option option a", which doesn't make any sense.\nAlso, if you are given a sample response, DO NOT JUST COPY IT! That would be plagarism, which is unethical. Instead, use it to create a somewhat similar response that covers the same points, while being unique. Basically, if I read your answer, I shouldn't be able to tell you could see the sample.\n\n# Question text: \n${questionText}`,
                },
                {
                  type: "image",
                  image: screenshot ?? "",
                },
              ],
            },
          ],
        });

        console.log(answer.object);

        for (const [index, value] of Object.entries(answer.object)) {
          const schemaValue = inputSchema?.find(
            // @ts-expect-error -- this is fine
            (i, idx) => idx.toString() === index || i.label === index,
          )!;
          const schemaIndex = inputSchema?.indexOf(schemaValue);

          if (typeof value === "string" && schemaValue.type === "select") {
            const selectElement = await questionElement?.$(
              `select.input-id-${index}`,
            );
            const val = await selectElement
              ?.$$eval(
                "option",
                (optionElements: HTMLOptionElement[], targetValue: string) =>
                  optionElements.map((option: HTMLOptionElement) => {
                    console.log(
                      "content",
                      option.textContent,
                      targetValue,
                      option.textContent?.trim() === targetValue.trim(),
                    );
                    return option.textContent?.trim() === targetValue.trim()
                      ? option.value
                      : undefined;
                  }),
                value,
              )
              .then((list: (string | undefined)[]) =>
                list.find(
                  (i: string | undefined) => i !== undefined && i !== null,
                ),
              );
            console.log("Selecting:", val);
            await selectElement?.select(val ?? "");
          } else if (
            schemaValue.type === "checkbox" ||
            schemaValue.type === "radio"
          ) {
            const inputElement = await questionElement?.$(
              `input.input-id-${schemaIndex}`,
            );
            console.log("clicking", value);
            if (value === true) await inputElement?.click();
          } else if (
            schemaValue.type === "input" ||
            schemaValue.type === "textarea"
          ) {
            const inputElement = await questionElement?.$(
              `${schemaValue.type}.input-id-${schemaIndex}`,
            );
            await inputElement?.type(value as string);
            if (schemaValue.type === "textarea") {
              await activityFrame.click("#btnCheck");
              await sleep(500);
              //   await activityFrame.waitForSelector("input[type=checkbox]");
            }
          }
        }
      }
      if (await previewFrame.$("#navBtnList")) {
        await waitAndClick(previewFrame, "nextQuestion");
        await completeActivity();
        return;
      }
      await activityFrame.click("#btnCheck");
      await activityFrame.waitForSelector("#btnExitAudio");
      await activityFrame.click(".FrameRight");
      await completeActivity();
    }
  }

  await setup();
}
