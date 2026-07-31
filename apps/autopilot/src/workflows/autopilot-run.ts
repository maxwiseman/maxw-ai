import { defineHook, sleep } from "workflow";
import { z } from "zod";

import type { AutopilotRunInput } from "~/server/autopilot-run";
import { env } from "~/env";

type RunStopReason =
  | "completed"
  | "error"
  | "manual"
  | "timeout"
  | "worker_lost";

async function callControlPlane(
  input: AutopilotRunInput,
  path: string,
  body: object,
): Promise<{ body: string; ok: boolean; status: number }> {
  "use step";

  const secret = env.AUTOPILOT_WORKER_SECRET;
  if (!secret) throw new Error("AUTOPILOT_WORKER_SECRET must be configured");
  const response = await fetch(`${input.controlUrl}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  return {
    body: await response.text(),
    ok: response.ok,
    status: response.status,
  };
}

async function callSandboxController(
  input: AutopilotRunInput,
  action: "provision" | "stop",
  finalStatus?: "error" | "stopped",
): Promise<void> {
  "use step";

  const secret = env.AUTOPILOT_WORKER_SECRET;
  if (!secret) throw new Error("AUTOPILOT_WORKER_SECRET must be configured");

  const response = await fetch(`${input.controlUrl}/api/autopilot/sandbox`, {
    body: JSON.stringify({ action, finalStatus, input }),
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      `Sandbox controller ${action} failed: ${response.status} ${await response.text()}`,
    );
  }
}

export const autopilotCompletionHook = defineHook({
  schema: z.object({
    reason: z.enum(["completed", "error", "manual"]),
  }),
});

export function getAutopilotCompletionToken(runId: string): string {
  return `autopilot-run:${runId}`;
}

async function waitForHeartbeatFailure(
  input: AutopilotRunInput,
): Promise<{ reason: "worker_lost" }> {
  while (true) {
    await sleep("5m");
    const response = await callControlPlane(
      input,
      "/api/autopilot/run/health",
      { runId: input.runId },
    );
    if (!response.ok) {
      throw new Error(`Heartbeat check failed: ${response.status}`);
    }
    const result = JSON.parse(response.body) as { alive: boolean };
    if (!result.alive) return { reason: "worker_lost" };
  }
}

async function recordStopAndNotify(
  input: AutopilotRunInput,
  reason: RunStopReason,
): Promise<void> {
  const response = await callControlPlane(input, "/api/autopilot/notify", {
    reason,
    runId: input.runId,
  });
  if (!response.ok) {
    throw new Error(`Stop notification failed: ${response.status}`);
  }
}

export async function manageAutopilotRun(input: AutopilotRunInput) {
  "use workflow";

  const completion = autopilotCompletionHook.create({
    token: getAutopilotCompletionToken(input.runId),
  });
  await completion.getConflict();

  let finalStatus: "error" | "stopped" = "stopped";
  let reason: RunStopReason = "error";
  try {
    await callSandboxController(input, "provision");
    const outcome = await Promise.race([
      completion,
      waitForHeartbeatFailure(input),
      sleep("24h").then(() => ({ reason: "timeout" as const })),
    ]);
    reason = outcome.reason;
    finalStatus = ["error", "worker_lost"].includes(reason)
      ? "error"
      : "stopped";
    return outcome;
  } catch (error) {
    finalStatus = "error";
    reason = "error";
    throw error;
  } finally {
    try {
      await callSandboxController(input, "stop", finalStatus);
    } finally {
      await recordStopAndNotify(input, reason);
    }
  }
}
