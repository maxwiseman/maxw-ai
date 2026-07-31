import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db/client";
import { autopilotRun } from "@acme/db/schema";

import { env } from "~/env";
import { sendAutopilotNotification } from "~/server/push-notifications";

const requestSchema = z.object({
  reason: z.enum(["completed", "error", "manual", "timeout", "worker_lost"]),
  runId: z.string().uuid(),
});

const reasonMessages = {
  completed: "Autopilot finished its run.",
  error: "Autopilot stopped because it encountered an error.",
  manual: "Autopilot was stopped by the user.",
  timeout: "Autopilot reached its maximum run time and stopped.",
  worker_lost: "Autopilot lost contact with its browser worker and stopped.",
} as const;

export async function POST(request: Request) {
  const secret = env.AUTOPILOT_WORKER_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const run = await db.query.autopilotRun.findFirst({
    where: eq(autopilotRun.id, parsed.data.runId),
  });
  if (!run) return new Response("Not found", { status: 404 });
  if (run.notificationSentAt || parsed.data.reason === "manual") {
    await db
      .update(autopilotRun)
      .set({ stopReason: parsed.data.reason })
      .where(eq(autopilotRun.id, run.id));
    return new Response(null, { status: 204 });
  }
  await sendAutopilotNotification(run.userId, {
    body: reasonMessages[parsed.data.reason],
    tag: `autopilot-stopped-${run.id}`,
    title: "Autopilot stopped",
    url: "/",
  });
  await db
    .update(autopilotRun)
    .set({ notificationSentAt: new Date(), stopReason: parsed.data.reason })
    .where(eq(autopilotRun.id, run.id));
  return new Response(null, { status: 204 });
}
