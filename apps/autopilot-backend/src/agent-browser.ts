import type { Page } from "puppeteer";

const COMMAND_TIMEOUT_MS = 120_000;

interface AgentBrowserTab {
  active: boolean;
  tabId: string;
  type: string;
  url: string;
}

interface AgentBrowserTabResponse {
  data?: { tabs?: AgentBrowserTab[] };
  success?: boolean;
}

function safeUrlLabel(value: string): string {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return url.protocol;
    return `${url.hostname}${url.pathname}`;
  } catch {
    return "unparseable-url";
  }
}

function normalizedPageLocation(value: string): string | null {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export class AgentBrowserSession {
  private connected = false;
  private readonly sessionName = `autopilot-${(
    process.env.AUTOPILOT_RUN_ID ?? crypto.randomUUID()
  ).replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  constructor(
    private readonly page: Page,
    private readonly signal?: AbortSignal,
    private readonly executable = "agent-browser",
  ) {}

  async run(args: string[]): Promise<string> {
    await this.ensureConnected();
    return this.execute(args);
  }

  async focusPage(): Promise<void> {
    if (!this.connected) {
      await this.ensureConnected();
      return;
    }
    await this.selectPuppeteerPage();
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;
    const endpoint = this.page.browser().wsEndpoint();
    if (!endpoint) {
      throw new Error("Chrome did not expose a CDP endpoint to agent-browser");
    }
    await this.execute(["connect", endpoint]);
    await this.selectPuppeteerPage();
    this.connected = true;
  }

  private async selectPuppeteerPage(): Promise<void> {
    const targetUrl = this.page.url();
    const output = await this.execute(["--json", "tab"]);
    let response: AgentBrowserTabResponse;
    try {
      response = JSON.parse(output) as AgentBrowserTabResponse;
    } catch {
      throw new Error("agent-browser returned an invalid tab listing");
    }

    const tabs =
      response.data?.tabs?.filter((tab) => tab.type === "page") ?? [];
    const exactMatches = tabs.filter((tab) => tab.url === targetUrl);
    const normalizedTarget = normalizedPageLocation(targetUrl);
    const normalizedMatches = normalizedTarget
      ? tabs.filter(
          (tab) => normalizedPageLocation(tab.url) === normalizedTarget,
        )
      : [];
    const matches = exactMatches.length > 0 ? exactMatches : normalizedMatches;

    console.log(
      JSON.stringify({
        candidates: tabs.map((tab) => ({
          active: tab.active,
          location: safeUrlLabel(tab.url),
          tabId: tab.tabId,
        })),
        event: "page_tab_selection",
        matchCount: matches.length,
        runId: process.env.AUTOPILOT_RUN_ID ?? "local",
        scope: "autopilot-browser",
        targetLocation: safeUrlLabel(targetUrl),
      }),
    );

    if (matches.length !== 1) {
      throw new Error(
        `Could not uniquely match the Puppeteer page in agent-browser (${safeUrlLabel(targetUrl)}; ${matches.length} matches)`,
      );
    }

    const [match] = matches;
    if (!match)
      throw new Error("The matched agent-browser tab was unavailable");
    if (!match.active) await this.execute(["tab", match.tabId]);
    const selectedUrl = await this.execute(["get", "url"]);
    const currentTargetUrl = this.page.url();
    if (
      selectedUrl !== currentTargetUrl &&
      normalizedPageLocation(selectedUrl) !==
        normalizedPageLocation(currentTargetUrl)
    ) {
      throw new Error(
        `agent-browser selected a different page than Puppeteer (${safeUrlLabel(selectedUrl)} instead of ${safeUrlLabel(currentTargetUrl)})`,
      );
    }
    console.log(
      JSON.stringify({
        event: "page_tab_selected",
        runId: process.env.AUTOPILOT_RUN_ID ?? "local",
        scope: "autopilot-browser",
        tabId: match.tabId,
        targetLocation: safeUrlLabel(targetUrl),
      }),
    );
  }

  private async execute(args: string[]): Promise<string> {
    if (this.signal?.aborted) throw new Error("Autopilot was stopped");

    const command =
      args.find((argument) => !argument.startsWith("-")) ?? "unknown";
    const startedAt = Date.now();
    console.log(
      JSON.stringify({
        argumentCount: Math.max(0, args.length - 1),
        command,
        event: "command_started",
        runId: process.env.AUTOPILOT_RUN_ID ?? "local",
        scope: "autopilot-browser",
      }),
    );

    const processHandle = Bun.spawn(
      [
        this.executable,
        "--session",
        this.sessionName,
        "--content-boundaries",
        "--max-output",
        "20000",
        ...args,
      ],
      { stderr: "pipe", stdout: "pipe" },
    );
    const abort = () => processHandle.kill();
    this.signal?.addEventListener("abort", abort, { once: true });

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const stdoutPromise = new Response(processHandle.stdout).text();
      const stderrPromise = new Response(processHandle.stderr).text();
      const exitCode = await Promise.race([
        processHandle.exited,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            processHandle.kill();
            reject(
              new Error(
                `agent-browser ${command} timed out after ${COMMAND_TIMEOUT_MS / 1000}s`,
              ),
            );
          }, COMMAND_TIMEOUT_MS);
        }),
      ]);
      const [stdout, stderr] = await Promise.all([
        stdoutPromise,
        stderrPromise,
      ]);
      if (exitCode !== 0) {
        throw new Error(
          `agent-browser ${command} failed: ${stderr.trim() || stdout.trim() || `exit ${exitCode}`}`,
        );
      }
      console.log(
        JSON.stringify({
          command,
          durationMs: Date.now() - startedAt,
          event: "command_finished",
          outputLength: stdout.length,
          runId: process.env.AUTOPILOT_RUN_ID ?? "local",
          scope: "autopilot-browser",
        }),
      );
      return stdout.trim() || "Command completed successfully.";
    } catch (error) {
      console.error(
        JSON.stringify({
          command,
          durationMs: Date.now() - startedAt,
          errorName: error instanceof Error ? error.name : "UnknownError",
          event: "command_failed",
          runId: process.env.AUTOPILOT_RUN_ID ?? "local",
          scope: "autopilot-browser",
        }),
      );
      throw error;
    } finally {
      clearTimeout(timer);
      this.signal?.removeEventListener("abort", abort);
    }
  }
}
