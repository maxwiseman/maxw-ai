import { and, eq } from "drizzle-orm";
import webPush from "web-push";

import { db } from "@acme/db/client";
import { pushSubscription } from "@acme/db/schema";

import { env } from "~/env";

export interface AutopilotNotification {
  body: string;
  tag: string;
  title: string;
  url?: string;
}

export function pushNotificationsConfigured(): boolean {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

export async function sendAutopilotNotification(
  userId: string,
  notification: AutopilotNotification,
): Promise<void> {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return;
  webPush.setVapidDetails(subject, publicKey, privateKey);

  const subscriptions = await db.query.pushSubscription.findMany({
    where: eq(pushSubscription.userId, userId),
  });
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { auth: subscription.auth, p256dh: subscription.p256dh },
          },
          JSON.stringify(notification),
          { TTL: 60 * 60, urgency: "high" },
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number(error.statusCode)
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await db
            .delete(pushSubscription)
            .where(
              and(
                eq(pushSubscription.userId, userId),
                eq(pushSubscription.endpoint, subscription.endpoint),
              ),
            );
          return;
        }
        console.error("Failed to send Autopilot push notification", error);
      }
    }),
  );
}
