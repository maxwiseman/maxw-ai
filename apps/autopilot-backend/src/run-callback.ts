import { createWorkerToken } from "./worker-token";

export async function notifyRunCompleted(userId: string): Promise<void> {
  const callbackUrl = process.env.AUTOPILOT_RUN_CALLBACK_URL;
  const runId = process.env.AUTOPILOT_RUN_ID;
  const secret = process.env.AUTOPILOT_WORKER_SECRET;
  if (!callbackUrl || !runId || !secret) return;

  try {
    const token = await createWorkerToken(
      { expiresInSeconds: 60, runId, userId },
      secret,
    );
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.error("Run completion callback failed:", response.status);
    }
  } catch (error) {
    console.error("Run completion callback failed:", error);
  }
}
