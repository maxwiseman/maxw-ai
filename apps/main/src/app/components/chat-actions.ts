"use server";

import { headers } from "next/headers";

import { auth } from "@acme/auth";
import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { chat } from "@acme/db/schema";

export async function getChats() {
  const authData = await auth.api.getSession({ headers: await headers() });
  if (!authData?.user) {
    return "Unauthorized";
  }
  const chats = await db.query.chat.findMany({
    where: eq(chat.userId, authData.user.id),
    with: {
      messages: {
        orderBy: (messages, { asc }) => [asc(messages.order)],
      },
    },
  });
  return chats;
}
