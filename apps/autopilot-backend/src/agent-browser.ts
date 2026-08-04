import type { Page } from "puppeteer";

const COMMAND_TIMEOUT_MS = 120_000;

export class AgentBrowserSession {
  private connected = false;
  private readonly sessionName = `autopilot-${(
    process.env.AUTOPILOT_RUN_ID ?? crypto.randomUUID()
  ).replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  constructor(
    private readonly page: Page,
    private readonly signal?: AbortSignal,
  ) {}

  async run(args: string[]): Promise<string> {
    await this.ensureConnected();
    return this.execute(args);
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;
    const endpoint = this.page.browser().wsEndpoint();
    if (!endpoint) {
      throw new Error("Chrome did not expose a CDP endpoint to agent-browser");
    }
    await this.execute(["connect", endpoint]);
    this.connected = true;
  }

  private async execute(args: string[]): Promise<string> {
    if (this.signal?.aborted) throw new Error("Autopilot was stopped");

    const command = args[0] ?? "unknown";
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
        "agent-browser",
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
                `agent-browser ${args[0] ?? "command"} timed out after ${COMMAND_TIMEOUT_MS / 1000}s`,
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
