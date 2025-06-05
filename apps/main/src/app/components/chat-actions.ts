"use server";

import { headers } from "next/headers";

import { auth } from "@acme/auth";
import { and, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { chat, message } from "@acme/db/schema";

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

export async function deleteChat(chatId: string) {
  const authData = await auth.api.getSession({ headers: await headers() });
  if (!authData?.user) {
    return "Unauthorized";
  }

  const chatData = await db.query.chat.findFirst({
    where: and(eq(chat.id, chatId), eq(chat.userId, authData.user.id)),
  });

  if (!chatData) {
    return "Chat cannot be deleted";
  }

  await db.transaction(async (tx) => {
    await tx.delete(message).where(eq(message.chatId, chatId)).execute();

    await tx
      .delete(chat)
      .where(and(eq(chat.id, chatId), eq(chat.userId, authData.user.id)))
      .execute();
  });
}
