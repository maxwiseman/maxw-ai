import { eq } from "drizzle-orm";
import { z } from "zod";

import { verifyWorkerToken } from "@acme/autopilot-backend/worker-token";
import { db } from "@acme/db/client";
import { autopilotRun } from "@acme/db/schema";

import { env } from "~/env";
import { sendAutopilotNotification } from "~/server/push-notifications";
import { autopilotCompletionHook } from "~/workflows/autopilot-run";

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heartbeat") }),
  z.object({
    type: z.literal("input_required"),
    question: z.string().min(1).max(1_000),
  }),
  z.object({
    type: z.literal("stopped"),
    reason: z.enum(["completed", "error", "manual"]),
  }),
]);

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
  const event = eventSchema.safeParse(await request.json());
  if (!event.success) {
    return Response.json({ error: event.error.flatten() }, { status: 400 });
  }
  if (event.data.type === "heartbeat") {
    await db
      .update(autopilotRun)
      .set({ lastHeartbeatAt: new Date() })
      .where(eq(autopilotRun.id, run.id));
    return new Response(null, { status: 204 });
  }
  if (event.data.type === "input_required") {
    await sendAutopilotNotification(run.userId, {
      body: event.data.question,
      tag: `autopilot-input-${run.id}`,
      title: "Autopilot needs your input",
      url: "/",
    });
    return new Response(null, { status: 204 });
  }
  if (["stopping", "stopped"].includes(run.status)) {
    return new Response(null, { status: 204 });
  }

  await db
    .update(autopilotRun)
    .set({ status: "stopping", stopReason: event.data.reason })
    .where(eq(autopilotRun.id, run.id));
  await autopilotCompletionHook.resume(`autopilot-run:${run.id}`, {
    reason: event.data.reason,
  });
  return new Response(null, { status: 202 });
}
