import type { autopilotRun } from "@acme/db/schema";
import { createWorkerToken } from "@acme/autopilot-backend/worker-token";

import { env } from "~/env";

const WORKER_TOKEN_LIFETIME_SECONDS = 25 * 60 * 60;

export interface AutopilotRunInput {
  controlUrl: string;
  runId: string;
  sandboxName: string;
  userId: string;
}

export interface AutopilotConnection {
  runId: string;
  status: "ready";
  token: string;
  workerUrl: string;
}

export function requiredWorkerSecret(): string {
  if (!env.AUTOPILOT_WORKER_SECRET) {
    throw new Error("AUTOPILOT_WORKER_SECRET must be configured");
  }
  return env.AUTOPILOT_WORKER_SECRET;
}

export async function createAutopilotConnection(
  run: typeof autopilotRun.$inferSelect,
): Promise<AutopilotConnection | null> {
  if (run.status !== "ready" || !run.workerUrl) return null;
  return {
    runId: run.id,
    status: "ready",
    token: await createWorkerToken(
      {
        expiresInSeconds: WORKER_TOKEN_LIFETIME_SECONDS,
        runId: run.id,
        userId: run.userId,
      },
      requiredWorkerSecret(),
    ),
    workerUrl: run.workerUrl,
  };
}
