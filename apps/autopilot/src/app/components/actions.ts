"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@acme/auth";
import { db } from "@acme/db/client";
import { configuration, invite, user } from "@acme/db/schema";

export async function getCode() {
  const authData = await auth.api.getSession({ headers: await headers() });
  if (!authData?.user) return "Unauthorized";

  const existingQuery = await db.query.invite.findFirst({
    where: eq(invite.createdBy, authData.user.id),
  });

  if (existingQuery && authData.user.invitesRemaining)
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      code: existingQuery.code!,
      remaining: authData.user.invitesRemaining,
    };
  if (!authData.user.invitesRemaining || authData.user.invitesRemaining <= 0)
    return false;

  const newCode = crypto.randomUUID().slice(0, 6).toUpperCase();
  await db
    .insert(invite)
    .values([{ code: newCode, createdBy: authData.user.id }]);
  return { code: newCode, remaining: authData.user.invitesRemaining - 1 };
}

export async function checkCode(code: string) {
  const authData = await auth.api.getSession({ headers: await headers() });
  if (!authData?.user) return "Unauthorized";

  const query = await db.query.invite.findFirst({
    where: eq(invite.code, code.toUpperCase()),
  });
  if (query) {
    await db
      .update(user)
      .set({ invitedTo: [...authData.user.invitedTo, "autopilot"] })
      .where(eq(user.id, authData.user.id));
    await db.delete(invite).where(eq(invite.code, code));
    const invitingUser = await db.query.user.findFirst({
      where: eq(user.id, query.createdBy),
    });
    await db
      .update(user)
      .set({ invitesRemaining: (invitingUser?.invitesRemaining ?? 0) - 1 })
      .where(eq(user.id, invitingUser?.id ?? ""));

    return true;
  }
  return false;
}

export async function getConfiguration() {
  const authData = await auth.api.getSession({ headers: await headers() });
  if (!authData?.user) return "Unauthorized";

  const query = await db.query.configuration.findFirst({
    where: eq(configuration.userId, authData.user.id),
  });
  return query;
}

export async function updateConfiguration(config: {
  username: string;
  password: string;
  timePerWord: number;
}) {
  const authData = await auth.api.getSession({ headers: await headers() });
  if (!authData?.user) return "Unauthorized";

  await db
    .insert(configuration)
    .values({
      userId: authData.user.id,
      serviceCredentials: config,
    })
    .onConflictDoUpdate({
      target: [configuration.userId],
      set: {
        serviceCredentials: config,
        ...config,
      },
    });
}
