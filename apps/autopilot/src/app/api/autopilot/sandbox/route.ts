import { z } from "zod";

import { env } from "~/env";

export const maxDuration = 300;

const requestSchema = z.object({
  action: z.enum(["provision", "stop"]),
  finalStatus: z.enum(["error", "stopped"]).optional(),
  input: z.object({
    controlUrl: z.string().url(),
    runId: z.string().uuid(),
    sandboxName: z.string().min(1),
    userId: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  const secret = env.AUTOPILOT_WORKER_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { action, finalStatus, input } = parsed.data;
  const controller = await import("~/server/autopilot-sandbox");
  if (action === "provision") {
    await controller.provisionAutopilotSandbox(input);
  } else {
    await controller.deleteAutopilotSandbox(input, finalStatus);
  }
  return new Response(null, { status: 204 });
}
