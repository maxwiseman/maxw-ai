import type { APIError, Sandbox } from "@vercel/sandbox";
import { and, eq } from "drizzle-orm";

import type { AutopilotRunProvisioningStage } from "@acme/db/schema";
import { db } from "@acme/db/client";
import { autopilotRun, sandboxBaseSnapshot } from "@acme/db/schema";

import type { AutopilotRunInput } from "~/server/autopilot-run";
import { env } from "~/env";
import { requiredWorkerSecret } from "~/server/autopilot-run";

const SANDBOX_PORT = 8080;
const WORKER_LOG_PATH = "/vercel/sandbox/.autopilot/worker.log";
const WORKER_LOG_CAPTURE_CHARS = 8_000;
const WORKER_LOG_TAIL_LINES = 200;
const BASE_READY_PATH = "/vercel/sandbox/.autopilot/base-ready";
const BASE_SANDBOX_NAME_PREFIX = "autopilot-base2";
const PUPPETEER_CACHE_DIR = "/vercel/sandbox/.cache/puppeteer";
// Hobby projects allow Sandbox sessions up to 45 minutes. Use a small margin
// so this deployment works on every Vercel plan. The shared base Sandbox is
// persistent, while each user Sandbox is deleted when its run finishes.
const SANDBOX_TIMEOUT_MS = 44 * 60 * 1000;
const SNAPSHOT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;
const BROWSER_SMOKE_TEST_SCRIPT = `
  import puppeteer from "puppeteer";
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  try {
    console.log(await browser.version());
  } finally {
    await browser.close();
  }
`;

function hasMissingSnapshotStatus(error: APIError<unknown>): boolean {
  return error.response.status === 404 || error.response.status === 410;
}

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
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY must be configured");
  }

  return {
    AUTH_SECRET: env.AUTH_SECRET ?? "",
    AUTOPILOT_RUN_CALLBACK_URL: `${input.controlUrl}/api/autopilot/run/complete`,
    AUTOPILOT_RUN_ID: input.runId,
    AUTOPILOT_USER_ID: input.userId,
    AUTOPILOT_WORKER_SECRET: requiredWorkerSecret(),
    DATABASE_AUTH_TOKEN: env.DATABASE_AUTH_TOKEN,
    DATABASE_URL: env.DATABASE_URL,
    NODE_ENV: "production",
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_COMPUTER_MODEL: env.OPENAI_COMPUTER_MODEL,
    PORT: String(SANDBOX_PORT),
    PUPPETEER_CACHE_DIR,
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

async function installAndVerifyBrowser(
  sandbox: Sandbox,
  replaceExisting = false,
): Promise<void> {
  if (replaceExisting) {
    await assertCommandSucceeded(sandbox, {
      args: ["-rf", `${PUPPETEER_CACHE_DIR}/chrome`],
      cmd: "rm",
    });
  }
  await assertCommandSucceeded(sandbox, {
    args: ["puppeteer", "browsers", "install", "chrome"],
    cmd: "bunx",
  });
  await assertCommandSucceeded(sandbox, {
    args: ["-e", BROWSER_SMOKE_TEST_SCRIPT],
    cmd: "bun",
  });
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
  await installAndVerifyBrowser(sandbox);
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

async function getStoredBaseSnapshotId(
  revision: string,
): Promise<string | undefined> {
  const stored = await db.query.sandboxBaseSnapshot.findFirst({
    where: eq(sandboxBaseSnapshot.revision, revision),
  });

  if (!stored) return;
  const { APIError, Snapshot } = await import("@vercel/sandbox");
  try {
    const snapshot = await Snapshot.get({
      ...getSandboxCredentials(),
      snapshotId: stored.snapshotId,
    });
    if (snapshot.status === "created") return stored.snapshotId;
  } catch (error) {
    if (!(error instanceof APIError) || !hasMissingSnapshotStatus(error)) {
      throw error;
    }
  }

  await db
    .delete(sandboxBaseSnapshot)
    .where(
      and(
        eq(sandboxBaseSnapshot.revision, revision),
        eq(sandboxBaseSnapshot.snapshotId, stored.snapshotId),
      ),
    );
}

async function storeBaseSnapshotId(
  revision: string,
  snapshotId: string,
): Promise<string> {
  await db
    .insert(sandboxBaseSnapshot)
    .values({ revision, snapshotId })
    .onConflictDoUpdate({
      set: { snapshotId, updatedAt: new Date() },
      target: sandboxBaseSnapshot.revision,
    });
  return snapshotId;
}

async function cleanupOldBaseArtifacts(
  keepSnapshotIds: ReadonlySet<string>,
): Promise<void> {
  const { APIError, Sandbox, Snapshot } = await import("@vercel/sandbox");
  const storedSnapshots = await db.select().from(sandboxBaseSnapshot);

  for (const stored of storedSnapshots) {
    if (keepSnapshotIds.has(stored.snapshotId)) continue;

    try {
      const snapshot = await Snapshot.get({
        ...getSandboxCredentials(),
        snapshotId: stored.snapshotId,
      });
      if (snapshot.status !== "deleted") await snapshot.delete();
    } catch (error) {
      if (!(error instanceof APIError) || !hasMissingSnapshotStatus(error)) {
        throw error;
      }
    }

    try {
      const baseSandbox = await Sandbox.get({
        ...getSandboxCredentials(),
        name: stored.revision,
        resume: false,
      });
      await baseSandbox.delete();
    } catch (error) {
      if (!(error instanceof APIError) || error.response.status !== 404) {
        console.warn("Could not delete retired base Sandbox", {
          error,
          name: stored.revision,
        });
      }
    }

    await db
      .delete(sandboxBaseSnapshot)
      .where(
        and(
          eq(sandboxBaseSnapshot.revision, stored.revision),
          eq(sandboxBaseSnapshot.snapshotId, stored.snapshotId),
        ),
      );
    console.log(
      JSON.stringify({
        event: "retired_base_artifact_deleted",
        sandboxName: stored.revision,
        snapshotId: stored.snapshotId,
      }),
    );
  }
}

async function finalizeBaseSnapshot(
  revision: string,
  snapshotId: string,
): Promise<string> {
  await storeBaseSnapshotId(revision, snapshotId);
  await cleanupOldBaseArtifacts(new Set([snapshotId]));
  return snapshotId;
}

async function setProvisioningStage(
  runId: string,
  provisioningStage: AutopilotRunProvisioningStage,
): Promise<void> {
  await db
    .update(autopilotRun)
    .set({ provisioningStage })
    .where(eq(autopilotRun.id, runId));
}

async function getBaseSnapshotId(runId: string): Promise<string> {
  const { Sandbox } = await import("@vercel/sandbox");
  const credentials = getSandboxCredentials();
  const name = getBaseSandboxName();
  await setProvisioningStage(runId, "preparing_environment");
  const existingSnapshotId = await getStoredBaseSnapshotId(name);
  if (existingSnapshotId) {
    await cleanupOldBaseArtifacts(new Set([existingSnapshotId]));
    await setProvisioningStage(runId, "restoring_snapshot");
    return existingSnapshotId;
  }

  const newestStoredSnapshot = (
    await db.select().from(sandboxBaseSnapshot)
  ).sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  )[0];
  await cleanupOldBaseArtifacts(
    new Set(newestStoredSnapshot ? [newestStoredSnapshot.snapshotId] : []),
  );

  await setProvisioningStage(runId, "installing_dependencies");
  const baseSandbox = await Sandbox.getOrCreate({
    ...credentials,
    env: { PUPPETEER_CACHE_DIR },
    keepLastSnapshots: {
      count: 1,
      deleteEvicted: true,
      expiration: SNAPSHOT_EXPIRATION_MS,
    },
    name,
    onCreate: bootstrapSandbox,
    persistent: true,
    resources: { vcpus: env.AUTOPILOT_SANDBOX_VCPUS },
    resume: false,
    snapshotExpiration: SNAPSHOT_EXPIRATION_MS,
    source: getSandboxSource(),
    timeout: SANDBOX_TIMEOUT_MS,
  });

  if (baseSandbox.currentSnapshotId) {
    return finalizeBaseSnapshot(name, baseSandbox.currentSnapshotId);
  }
  if (!(await isBaseSandboxReady(baseSandbox))) {
    await bootstrapSandbox(baseSandbox);
  }

  try {
    const snapshot = await baseSandbox.snapshot({
      expiration: SNAPSHOT_EXPIRATION_MS,
    });
    // snapshot() stops the source VM. Do not delete this named Sandbox here:
    // Vercel would also delete the snapshot that user Sandboxes restore from.
    return finalizeBaseSnapshot(name, snapshot.snapshotId);
  } catch (error) {
    // Another concurrent provision may have snapshotted the shared base first.
    const refreshedBase = await Sandbox.get({
      ...credentials,
      name,
      resume: false,
    });
    if (refreshedBase.currentSnapshotId) {
      return finalizeBaseSnapshot(name, refreshedBase.currentSnapshotId);
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
  const logs = await sandbox.runCommand({
    args: ["-n", "60", WORKER_LOG_PATH],
    cmd: "tail",
  });
  const detail = logs.exitCode === 0 ? (await logs.stdout()).trim() : "";
  throw new Error(
    `Autopilot worker did not become healthy within 30 seconds${detail ? `:\n${detail.slice(-2_000)}` : ""}`,
  );
}

function isCorruptBrowserInstallation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Error loading V8 startup snapshot file")
  );
}

export async function provisionAutopilotSandbox(
  input: AutopilotRunInput,
): Promise<{ workerUrl: string }> {
  const { APIError, Sandbox } = await import("@vercel/sandbox");
  try {
    let baseSnapshotId = await getBaseSnapshotId(input.runId);
    await setProvisioningStage(input.runId, "creating_sandbox");
    const createSandbox = (snapshotId: string) =>
      Sandbox.getOrCreate({
        ...getSandboxCredentials(),
        env: getSandboxEnvironment(input),
        name: input.sandboxName,
        persistent: false,
        ports: [SANDBOX_PORT],
        resources: { vcpus: env.AUTOPILOT_SANDBOX_VCPUS },
        source: { snapshotId, type: "snapshot" },
        timeout: SANDBOX_TIMEOUT_MS,
      });

    let sandbox: Sandbox;
    try {
      sandbox = await createSandbox(baseSnapshotId);
    } catch (error) {
      if (!(error instanceof APIError) || !hasMissingSnapshotStatus(error)) {
        throw error;
      }

      await db
        .delete(sandboxBaseSnapshot)
        .where(
          and(
            eq(sandboxBaseSnapshot.revision, getBaseSandboxName()),
            eq(sandboxBaseSnapshot.snapshotId, baseSnapshotId),
          ),
        );
      console.warn("Stored base snapshot was unavailable; rebuilding it", {
        snapshotId: baseSnapshotId,
      });
      baseSnapshotId = await getBaseSnapshotId(input.runId);
      await setProvisioningStage(input.runId, "creating_sandbox");
      sandbox = await createSandbox(baseSnapshotId);
    }
    await setProvisioningStage(input.runId, "starting_worker");
    let workerUrl: string;
    try {
      workerUrl = await startWorker(sandbox);
    } catch (error) {
      if (!isCorruptBrowserInstallation(error)) throw error;

      console.warn(
        "Restored Chrome installation was corrupt; reinstalling in the user Sandbox",
        { snapshotId: baseSnapshotId },
      );
      await setProvisioningStage(input.runId, "installing_dependencies");
      await installAndVerifyBrowser(sandbox, true);
      await setProvisioningStage(input.runId, "starting_worker");
      workerUrl = await startWorker(sandbox);
    }
    await db
      .update(autopilotRun)
      .set({
        lastError: null,
        provisioningStage: null,
        status: "ready",
        workerUrl,
      })
      .where(eq(autopilotRun.id, input.runId));
    return { workerUrl };
  } catch (error) {
    await db
      .update(autopilotRun)
      .set({
        lastError: error instanceof Error ? error.message : String(error),
        provisioningStage: null,
      })
      .where(eq(autopilotRun.id, input.runId));
    throw error;
  }
}

export async function deleteAutopilotSandbox(
  input: AutopilotRunInput,
  finalStatus: "error" | "stopped" = "stopped",
): Promise<void> {
  const { APIError, Sandbox } = await import("@vercel/sandbox");
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
        args: ["-n", String(WORKER_LOG_TAIL_LINES), WORKER_LOG_PATH],
        cmd: "tail",
      });
      if (logs.exitCode === 0) {
        const output = (await logs.stdout()).trim();
        if (output) {
          workerError = `Worker diagnostic log before cleanup:\n${output.slice(
            -WORKER_LOG_CAPTURE_CHARS,
          )}`;
        }
      }
    }
    await sandbox.delete();
  } catch (error) {
    if (error instanceof APIError && error.response.status === 404) {
      console.warn("Sandbox was already unavailable during cleanup", error);
    } else {
      throw error;
    }
  } finally {
    await db
      .update(autopilotRun)
      .set({
        ...(workerError ? { lastError: workerError } : {}),
        provisioningStage: null,
        status: finalStatus,
        workerUrl: null,
      })
      .where(eq(autopilotRun.id, input.runId));
  }
}
