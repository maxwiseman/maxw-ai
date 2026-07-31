import { createWorkerToken } from "./worker-token";

export type WorkerEvent =
  | { type: "heartbeat" }
  | { type: "input_required"; question: string }
  | { type: "stopped"; reason: "completed" | "error" | "manual" };

export async function notifyControlPlane(
  userId: string,
  event: WorkerEvent,
): Promise<boolean> {
  const callbackUrl = process.env.AUTOPILOT_RUN_CALLBACK_URL;
  const runId = process.env.AUTOPILOT_RUN_ID;
  const secret = process.env.AUTOPILOT_WORKER_SECRET;
  if (!callbackUrl || !runId || !secret) return false;

  try {
    const token = await createWorkerToken(
      { expiresInSeconds: 60, runId, userId },
      secret,
    );
    const response = await fetch(callbackUrl, {
      body: JSON.stringify(event),
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      console.error("Run completion callback failed:", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Run completion callback failed:", error);
    return false;
  }
}

export function startHeartbeat(userId: string): () => void {
  void notifyControlPlane(userId, { type: "heartbeat" });
  const timer = setInterval(
    () => void notifyControlPlane(userId, { type: "heartbeat" }),
    30_000,
  );
  return () => clearInterval(timer);
}
