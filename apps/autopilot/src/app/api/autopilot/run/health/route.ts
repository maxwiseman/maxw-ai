import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db/client";
import { autopilotRun } from "@acme/db/schema";

import { env } from "~/env";

const requestSchema = z.object({ runId: z.string().uuid() });
const HEARTBEAT_STALE_MS = 2 * 60 * 1000;

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
  const alive = !!(
    run?.lastHeartbeatAt &&
    ["provisioning", "ready"].includes(run.status) &&
    Date.now() - run.lastHeartbeatAt.getTime() < HEARTBEAT_STALE_MS
  );
  return Response.json({ alive });
}
