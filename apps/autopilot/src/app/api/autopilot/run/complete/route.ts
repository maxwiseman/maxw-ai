import { eq } from "drizzle-orm";

import { verifyWorkerToken } from "@acme/autopilot-backend/worker-token";
import { db } from "@acme/db/client";
import { autopilotRun } from "@acme/db/schema";

import { env } from "~/env";
import { autopilotCompletionHook } from "~/workflows/autopilot-run";

export async function POST(request: Request) {
  const secret = env.AUTOPILOT_WORKER_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await verifyWorkerToken(authorization.slice(7), secret);
  if (!payload) return new Response("Unauthorized", { status: 401 });

  const run = await db.query.autopilotRun.findFirst({
    where: eq(autopilotRun.id, payload.runId),
  });
  if (!run || run.userId !== payload.userId) {
    return new Response("Not found", { status: 404 });
  }
  if (["stopping", "stopped"].includes(run.status)) {
    return new Response(null, { status: 204 });
  }

  await db
    .update(autopilotRun)
    .set({ status: "stopping" })
    .where(eq(autopilotRun.id, run.id));
  await autopilotCompletionHook.resume(`autopilot-run:${run.id}`, {
    reason: "completed",
  });
  return new Response(null, { status: 202 });
}
