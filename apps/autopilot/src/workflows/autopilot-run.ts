import { defineHook, sleep } from "workflow";
import { z } from "zod";

import { env } from "~/env";
import type { AutopilotRunInput } from "~/server/autopilot-run";

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
    reason: z.enum(["completed", "stopped"]),
  }),
});

export function getAutopilotCompletionToken(runId: string): string {
  return `autopilot-run:${runId}`;
}

export async function manageAutopilotRun(input: AutopilotRunInput) {
  "use workflow";

  const completion = autopilotCompletionHook.create({
    token: getAutopilotCompletionToken(input.runId),
  });
  await completion.getConflict();

  let finalStatus: "error" | "stopped" = "stopped";
  try {
    await callSandboxController(input, "provision");
    return await Promise.race([
      completion,
      sleep("24h").then(() => ({ reason: "stopped" as const })),
    ]);
  } catch (error) {
    finalStatus = "error";
    throw error;
  } finally {
    await callSandboxController(input, "stop", finalStatus);
  }
}
