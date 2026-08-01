import type { Sandbox } from "@vercel/sandbox";
import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { autopilotRun } from "@acme/db/schema";

import type { AutopilotRunInput } from "~/server/autopilot-run";
import { env } from "~/env";
import { requiredWorkerSecret } from "~/server/autopilot-run";

const SANDBOX_PORT = 8080;
const WORKER_LOG_PATH = "/vercel/sandbox/.autopilot/worker.log";
const BASE_READY_PATH = "/vercel/sandbox/.autopilot/base-ready";
const BASE_SANDBOX_NAME_PREFIX = "autopilot-base";
// Hobby projects allow Sandbox sessions up to 45 minutes. Use a small margin
// so this deployment works on every Vercel plan; named Sandbox persistence
// still preserves the filesystem between sessions.
const SANDBOX_TIMEOUT_MS = 44 * 60 * 1000;
const SNAPSHOT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

const CHROMIUM_SYSTEM_DEPS = [
  "nss",
  "nspr",
  "libxkbcommon",
  "atk",
  "at-spi2-atk",
  "at-spi2-core",
  "libXcomposite",
  "libXdamage",
  "libXrandr",
  "libXfixes",
  "libXcursor",
  "libXi",
  "libXtst",
  "libXScrnSaver",
  "libXext",
  "mesa-libgbm",
  "libdrm",
  "mesa-libGL",
  "mesa-libEGL",
  "cups-libs",
  "alsa-lib",
  "pango",
  "cairo",
  "gtk3",
  "dbus-libs",
];

function getSandboxCredentials() {
  if (env.VERCEL_TOKEN && env.VERCEL_TEAM_ID && env.VERCEL_PROJECT_ID) {
    return {
      projectId: env.VERCEL_PROJECT_ID,
      teamId: env.VERCEL_TEAM_ID,
      token: env.VERCEL_TOKEN,
    };
  }
  return {};
}

function getSandboxSource() {
  const base = {
    depth: 1,
    revision: env.VERCEL_GIT_COMMIT_SHA ?? env.AUTOPILOT_SANDBOX_REPO_REF,
    type: "git" as const,
    url: env.AUTOPILOT_SANDBOX_REPO_URL,
  };
  if (
    env.AUTOPILOT_SANDBOX_REPO_USERNAME &&
    env.AUTOPILOT_SANDBOX_REPO_PASSWORD
  ) {
    return {
      ...base,
      password: env.AUTOPILOT_SANDBOX_REPO_PASSWORD,
      username: env.AUTOPILOT_SANDBOX_REPO_USERNAME,
    };
  }
  return base;
}

function getBaseSandboxName(): string {
  const revision = env.VERCEL_GIT_COMMIT_SHA ?? env.AUTOPILOT_SANDBOX_REPO_REF;
  const safeRevision = revision
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .slice(0, 48);
  return `${BASE_SANDBOX_NAME_PREFIX}-${safeRevision}`;
}

function getSandboxEnvironment(input: AutopilotRunInput) {
  if (!env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY must be configured");
  }

  return {
    AI_GATEWAY_API_KEY: env.AI_GATEWAY_API_KEY,
    AI_GATEWAY_MODEL: env.AI_GATEWAY_MODEL,
    AUTH_SECRET: env.AUTH_SECRET ?? "",
    AUTOPILOT_RUN_CALLBACK_URL: `${input.controlUrl}/api/autopilot/run/complete`,
    AUTOPILOT_RUN_ID: input.runId,
    AUTOPILOT_USER_ID: input.userId,
    AUTOPILOT_WORKER_SECRET: requiredWorkerSecret(),
    DATABASE_AUTH_TOKEN: env.DATABASE_AUTH_TOKEN,
    DATABASE_URL: env.DATABASE_URL,
    NODE_ENV: "production",
    PORT: String(SANDBOX_PORT),
    PUPPETEER_CACHE_DIR: "/vercel/sandbox/.cache/puppeteer",
  };
}

async function assertCommandSucceeded(
  sandbox: Sandbox,
  command: { args: string[]; cmd: string; sudo?: boolean },
) {
  const result = await sandbox.runCommand(command);
  if (result.exitCode !== 0) {
    throw new Error(
      `${command.cmd} failed: ${(await result.stderr()).trim() || `exit ${result.exitCode}`}`,
    );
  }
}

async function bootstrapSandbox(sandbox: Sandbox): Promise<void> {
  await assertCommandSucceeded(sandbox, {
    args: ["install", "-y", ...CHROMIUM_SYSTEM_DEPS],
    cmd: "dnf",
    sudo: true,
  });
  await assertCommandSucceeded(sandbox, {
    args: ["install", "-g", "bun@1.2.15"],
    cmd: "npm",
    sudo: true,
  });
  await assertCommandSucceeded(sandbox, {
    args: ["install", "--frozen-lockfile"],
    cmd: "bun",
  });
  await assertCommandSucceeded(sandbox, {
    args: ["puppeteer", "browsers", "install", "chrome"],
    cmd: "bunx",
  });
  await assertCommandSucceeded(sandbox, {
    args: ["-p", "/vercel/sandbox/.autopilot"],
    cmd: "mkdir",
  });
  await assertCommandSucceeded(sandbox, {
    args: [BASE_READY_PATH],
    cmd: "touch",
  });
}

async function isBaseSandboxReady(sandbox: Sandbox): Promise<boolean> {
  const result = await sandbox.runCommand({
    args: ["-f", BASE_READY_PATH],
    cmd: "test",
  });
  return result.exitCode === 0;
}

async function getBaseSnapshotId(): Promise<string> {
  const { Sandbox } = await import("@vercel/sandbox");
  const credentials = getSandboxCredentials();
  const name = getBaseSandboxName();
  const baseSandbox = await Sandbox.getOrCreate({
    ...credentials,
    keepLastSnapshots: { count: 1 },
    name,
    onCreate: bootstrapSandbox,
    persistent: true,
    resources: { vcpus: env.AUTOPILOT_SANDBOX_VCPUS },
    resume: false,
    snapshotExpiration: SNAPSHOT_EXPIRATION_MS,
    source: getSandboxSource(),
    timeout: SANDBOX_TIMEOUT_MS,
  });

  if (baseSandbox.currentSnapshotId) return baseSandbox.currentSnapshotId;
  if (!(await isBaseSandboxReady(baseSandbox))) {
    await bootstrapSandbox(baseSandbox);
  }

  try {
    const snapshot = await baseSandbox.snapshot({
      expiration: SNAPSHOT_EXPIRATION_MS,
    });
    return snapshot.snapshotId;
  } catch (error) {
    // Another concurrent provision may have snapshotted the shared base first.
    const refreshedBase = await Sandbox.get({
      ...credentials,
      name,
      resume: false,
    });
    if (refreshedBase.currentSnapshotId) {
      return refreshedBase.currentSnapshotId;
    }
    throw error;
  }
}

async function isWorkerHealthy(workerUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${workerUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function startWorker(sandbox: Sandbox): Promise<string> {
  const workerUrl = sandbox.domain(SANDBOX_PORT);
  if (!(await isWorkerHealthy(workerUrl))) {
    await sandbox.runCommand({
      args: ["-p", "/vercel/sandbox/.autopilot"],
      cmd: "mkdir",
    });
    await sandbox.runCommand({
      args: [
        "-lc",
        `exec bun --filter @acme/autopilot-backend start > ${WORKER_LOG_PATH} 2>&1`,
      ],
      cmd: "sh",
      cwd: "/vercel/sandbox",
      detached: true,
    });
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isWorkerHealthy(workerUrl)) return workerUrl;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Autopilot worker did not become healthy within 30 seconds");
}

export async function provisionAutopilotSandbox(
  input: AutopilotRunInput,
): Promise<{ workerUrl: string }> {
  const { Sandbox } = await import("@vercel/sandbox");
  try {
    const baseSnapshotId = await getBaseSnapshotId();
    const sandbox = await Sandbox.getOrCreate({
      ...getSandboxCredentials(),
      env: getSandboxEnvironment(input),
      keepLastSnapshots: { count: 1 },
      name: input.sandboxName,
      persistent: true,
      ports: [SANDBOX_PORT],
      resources: { vcpus: env.AUTOPILOT_SANDBOX_VCPUS },
      snapshotExpiration: SNAPSHOT_EXPIRATION_MS,
      source: { snapshotId: baseSnapshotId, type: "snapshot" },
      timeout: SANDBOX_TIMEOUT_MS,
    });
    const workerUrl = await startWorker(sandbox);
    await db
      .update(autopilotRun)
      .set({ lastError: null, status: "ready", workerUrl })
      .where(eq(autopilotRun.id, input.runId));
    return { workerUrl };
  } catch (error) {
    await db
      .update(autopilotRun)
      .set({
        lastError: error instanceof Error ? error.message : String(error),
      })
      .where(eq(autopilotRun.id, input.runId));
    throw error;
  }
}

export async function stopAutopilotSandbox(
  input: AutopilotRunInput,
  finalStatus: "error" | "stopped" = "stopped",
): Promise<void> {
  const { Sandbox } = await import("@vercel/sandbox");
  let workerError: string | undefined;
  await db
    .update(autopilotRun)
    .set({ status: "stopping" })
    .where(eq(autopilotRun.id, input.runId));

  try {
    const sandbox = await Sandbox.get({
      ...getSandboxCredentials(),
      name: input.sandboxName,
      resume: false,
    });
    if (finalStatus === "error") {
      const logs = await sandbox.runCommand({
        args: ["-n", "60", WORKER_LOG_PATH],
        cmd: "tail",
      });
      if (logs.exitCode === 0) {
        const output = (await logs.stdout()).trim();
        if (output) workerError = output.slice(-2_000);
      }
    }
    if (sandbox.status !== "stopped") await sandbox.stop();
  } catch (error) {
    console.warn("Sandbox was already unavailable during cleanup", error);
  } finally {
    await db
      .update(autopilotRun)
      .set({
        ...(workerError ? { lastError: workerError } : {}),
        status: finalStatus,
        workerUrl: null,
      })
      .where(eq(autopilotRun.id, input.runId));
  }
}
