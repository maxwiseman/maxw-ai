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

export async function branchOff(chatId: string, fromMessageId: string) {
  const authData = await auth.api.getSession({ headers: await headers() });
  if (!authData?.user) {
    return { status: "error", message: "Unauthorized" };
  }
  const chatData = await db.query.chat.findFirst({
    where: and(eq(chat.id, chatId), eq(chat.userId, authData.user.id)),
    with: {
      messages: {
        orderBy: (messages, { asc }) => [asc(messages.order)],
      },
    },
  });
  // TODO: Check if the chat is public
  if (!chatData || chatData.userId !== authData.user.id) {
    return { status: "error", message: "Chat cannot be branched off" };
  }
  let hasFromMessage = false;
  const newMessages = chatData.messages.filter((message) => {
    if (message.id === fromMessageId) {
      hasFromMessage = true;
      return true;
    }
    return !hasFromMessage;
  });
  newMessages[newMessages.length - 1] = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ...newMessages[newMessages.length - 1]!,
    parts: [
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ...newMessages[newMessages.length - 1]!.parts,
      {
        type: "data-branch",
        data: {
          fromMessageId,
          fromChatId: chatId,
          fromChatName: chatData.name,
        },
      },
    ],
  };
  const newChatId = crypto.randomUUID();
  await db
    .insert(chat)
    .values({
      ...chatData,
      id: newChatId,
      name: `${chatData.name} (branch)`,
      userId: authData.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .execute();
  await db
    .insert(message)
    .values(
      newMessages.map((message) => ({
        ...message,
        chatId: newChatId,
        id: crypto.randomUUID(),
      })),
    )
    .execute();
  return { status: "success", newChatId };
}
