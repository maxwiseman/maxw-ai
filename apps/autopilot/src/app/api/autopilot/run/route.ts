import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { start } from "workflow/api";

import { auth } from "@acme/auth";
import { db } from "@acme/db/client";
import { autopilotRun } from "@acme/db/schema";

import { env } from "~/env";
import { createAutopilotConnection } from "~/server/autopilot-run";
import { manageAutopilotRun } from "~/workflows/autopilot-run";

async function getUser() {
  return (
    (await auth.api.getSession({ headers: await headers() }))?.user ?? null
  );
}

async function getUserRun(userId: string) {
  return db.query.autopilotRun.findFirst({
    where: eq(autopilotRun.userId, userId),
  });
}

export async function GET() {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const run = await getUserRun(user.id);
  if (!run) return Response.json({ run: null });
  const connection = await createAutopilotConnection(run);
  return Response.json({
    run: connection ?? {
      lastError: run.lastError,
      runId: run.id,
      status: run.status,
    },
  });
}

export async function POST() {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.invitedTo.includes("autopilot")) {
    return new Response("Forbidden", { status: 403 });
  }

  const existing = await getUserRun(user.id);
  if (
    existing &&
    ["provisioning", "ready", "stopping"].includes(existing.status)
  ) {
    const connection = await createAutopilotConnection(existing);
    return Response.json(
      {
        run: connection ?? { runId: existing.id, status: existing.status },
      },
      { status: connection ? 200 : 202 },
    );
  }

  const runId = crypto.randomUUID();
  const input = {
    controlUrl: new URL(env.BETTER_AUTH_URL).origin,
    runId,
    sandboxName: `autopilot-${runId}`,
    userId: user.id,
  };
  await db
    .insert(autopilotRun)
    .values({
      id: input.runId,
      sandboxName: input.sandboxName,
      status: "provisioning",
      userId: input.userId,
    })
    .onConflictDoUpdate({
      target: autopilotRun.userId,
      set: {
        id: input.runId,
        lastError: null,
        sandboxName: input.sandboxName,
        status: "provisioning",
        lastHeartbeatAt: null,
        notificationSentAt: null,
        stopReason: null,
        workerUrl: null,
        workflowRunId: null,
      },
    });

  try {
    const workflowRun = await start(manageAutopilotRun, [input]);
    await db
      .update(autopilotRun)
      .set({ workflowRunId: workflowRun.runId })
      .where(eq(autopilotRun.id, runId));
  } catch (error) {
    await db
      .update(autopilotRun)
      .set({
        lastError: error instanceof Error ? error.message : String(error),
        status: "error",
      })
      .where(eq(autopilotRun.id, runId));
    throw error;
  }

  return Response.json(
    { run: { runId, status: "provisioning" } },
    { status: 202 },
  );
}

export async function DELETE() {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const run = await getUserRun(user.id);
  if (!run || ["stopping", "stopped", "error"].includes(run.status)) {
    return new Response(null, { status: 204 });
  }

  await db
    .update(autopilotRun)
    .set({ status: "stopping", stopReason: "manual" })
    .where(eq(autopilotRun.id, run.id));
  await import("~/workflows/autopilot-run").then(
    ({ autopilotCompletionHook }) =>
      autopilotCompletionHook.resume(`autopilot-run:${run.id}`, {
        reason: "manual",
      }),
  );
  return new Response(null, { status: 202 });
}
