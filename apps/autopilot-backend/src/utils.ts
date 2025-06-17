import * as fs from "fs/promises";
import type {
  Browser,
  ClickOptions,
  ElementHandle,
  Frame,
  KeyboardTypeOptions,
  NodeFor,
  Page,
  PDFOptions,
  WaitForSelectorOptions,
} from "puppeteer";
import MarkdownIt from "markdown-it";
import fetch from "node-fetch";

import markdownCSS from "./markdown.css" assert { type: "text" };

export async function whatComesFirst<T extends string>(
  page: Page | Frame,
  selectors: T[],
): Promise<{ selector: T; element: ElementHandle<NodeFor<T>> | null }> {
  const promises = selectors.map(async (selector) => {
    return { selector, element: await page.waitForSelector(selector) };
  });
  return await Promise.race(promises);
}

export async function downloadFile(url: string, path: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }

  // 1) Read entire body into an ArrayBuffer
  const arrayBuffer = await response.arrayBuffer();

  // 2) Convert to Node Buffer
  const buffer = Buffer.from(arrayBuffer);

  // 3) Optionally write to disk if path is provided
  if (path) {
    await fs.writeFile(path, buffer.toString());
    console.log(`File saved to ${path}`);
  }

  // 4) Return Base64 string
  return buffer.toString("base64");
}

export async function markdownToPdf(
  browser: Browser,
  opts: {
    src: string;
    dest: string;
    css?: string;
    format?: PDFOptions["format"];
  },
): Promise<void> {
  const md = new MarkdownIt();

  const markdown = opts.src;

  // Render to HTML
  const htmlBody = md.render(markdown);

  // Construct full HTML document
  const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            ${markdownCSS}
            ${opts.css ?? ""}
          </style>
        </head>
        <body>${htmlBody}</body>
      </html>
    `;

  // Launch headless Chrome and generate PDF
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({
    path: opts.dest,
    format: opts.format ?? "letter",
    printBackground: true,
    margin: { top: "1in", bottom: "1in", left: "1in", right: "1in" },
  });
  await page.close();

  console.log(`PDF generated at ${opts.dest}`);
}

export async function downloadFileAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }

  // Read the entire response into an ArrayBuffer
  const arrayBuffer = await response.arrayBuffer();

  // Convert ArrayBuffer to Buffer, then to base64
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return base64;
}

export async function waitAndClick(
  page: Page | Frame,
  selector: string,
  opts?: WaitForSelectorOptions & ClickOptions,
): Promise<void> {
  await page.waitForSelector(selector, opts);
  await page.click(selector, opts);
}

export async function waitAndType(
  page: Page,
  selector: string,
  text: string,
  opts?: WaitForSelectorOptions & KeyboardTypeOptions,
): Promise<void> {
  await page.waitForSelector(selector, opts);
  await page.type(selector, text);
}

export function logToFile(...args: any[]): void {
  // Join the arguments into a single output string, formatting objects as JSON
  const formatted = args
    .map((arg) => {
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");

  // Append the formatted log to './logs.txt' with a newline in a fire-and-forget manner
  fs.appendFile("./logs.txt", formatted + "\n", { flag: "a" }).catch((error) =>
    console.error("Failed to log to file:", error),
  );
}
