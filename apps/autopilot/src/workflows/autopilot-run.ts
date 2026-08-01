import { eq } from "drizzle-orm";
import { defineHook, sleep } from "workflow";
import { z } from "zod";

import { db } from "@acme/db/client";
import { autopilotRun } from "@acme/db/schema";

import type { AutopilotRunInput } from "~/server/autopilot-run";
import {
  deleteAutopilotSandbox,
  provisionAutopilotSandbox,
} from "~/server/autopilot-sandbox";
import { sendAutopilotNotification } from "~/server/push-notifications";

type RunStopReason =
  | "completed"
  | "error"
  | "manual"
  | "timeout"
  | "worker_lost";

async function callSandboxController(
  input: AutopilotRunInput,
  action: "provision" | "stop",
  finalStatus?: "error" | "stopped",
): Promise<void> {
  "use step";

  if (action === "provision") await provisionAutopilotSandbox(input);
  else await deleteAutopilotSandbox(input, finalStatus);
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
    if (!(await isWorkerAlive(input.runId))) return { reason: "worker_lost" };
  }
}

async function isWorkerAlive(runId: string): Promise<boolean> {
  "use step";

  const run = await db.query.autopilotRun.findFirst({
    where: eq(autopilotRun.id, runId),
  });
  return !!(
    run?.lastHeartbeatAt &&
    ["provisioning", "ready"].includes(run.status) &&
    Date.now() - run.lastHeartbeatAt.getTime() < 2 * 60 * 1_000
  );
}

async function recordStopAndNotify(
  input: AutopilotRunInput,
  reason: RunStopReason,
): Promise<void> {
  "use step";

  const run = await db.query.autopilotRun.findFirst({
    where: eq(autopilotRun.id, input.runId),
  });
  if (!run) return;
  if (!run.notificationSentAt && reason !== "manual") {
    const messages: Record<Exclude<RunStopReason, "manual">, string> = {
      completed: "Autopilot finished its run.",
      error: "Autopilot stopped because it encountered an error.",
      timeout: "Autopilot reached its maximum run time and stopped.",
      worker_lost:
        "Autopilot lost contact with its browser worker and stopped.",
    };
    await sendAutopilotNotification(run.userId, {
      body: messages[reason],
      tag: `autopilot-stopped-${run.id}`,
      title: "Autopilot stopped",
      url: "/",
    });
  }
  await db
    .update(autopilotRun)
    .set({
      notificationSentAt:
        reason === "manual" ? run.notificationSentAt : new Date(),
      stopReason: reason,
    })
    .where(eq(autopilotRun.id, run.id));
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
