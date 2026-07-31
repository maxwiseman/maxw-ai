import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@acme/auth";
import { db } from "@acme/db/client";
import { pushSubscription } from "@acme/db/schema";

import { env } from "~/env";
import { pushNotificationsConfigured } from "~/server/push-notifications";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
});

async function getUser() {
  return (
    (await auth.api.getSession({ headers: await headers() }))?.user ?? null
  );
}

export async function GET() {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const existing = await db.query.pushSubscription.findFirst({
    where: eq(pushSubscription.userId, user.id),
  });
  return Response.json({
    configured: pushNotificationsConfigured(),
    publicKey: env.VAPID_PUBLIC_KEY ?? null,
    subscribed: !!existing,
  });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!pushNotificationsConfigured()) {
    return new Response("Push notifications are not configured", {
      status: 503,
    });
  }
  const parsed = subscriptionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await db
    .insert(pushSubscription)
    .values({
      auth: parsed.data.keys.auth,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      userId: user.id,
    })
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: {
        auth: parsed.data.keys.auth,
        p256dh: parsed.data.keys.p256dh,
        userId: user.id,
      },
    });
  return new Response(null, { status: 204 });
}

export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (endpoint) {
    await db
      .delete(pushSubscription)
      .where(
        and(
          eq(pushSubscription.userId, user.id),
          eq(pushSubscription.endpoint, endpoint),
        ),
      );
  } else {
    await db
      .delete(pushSubscription)
      .where(eq(pushSubscription.userId, user.id));
  }
  return new Response(null, { status: 204 });
}
