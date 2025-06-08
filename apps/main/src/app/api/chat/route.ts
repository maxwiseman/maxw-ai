import type { UIDataTypes, UIMessage } from "ai";
import { headers } from "next/headers";
import { gateway } from "@vercel/ai-sdk-gateway";
import {
  convertToModelMessages,
  extractReasoningMiddleware,
  generateText,
  smoothStream,
  streamText,
  wrapLanguageModel,
} from "ai";

// import { nanoid } from "nanoid";

import { auth } from "@acme/auth";
import { buildConflictUpdateColumns, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { chat, message } from "@acme/db/schema";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const data = (await req.json()) as {
    id: string;
    messages: UIMessage<unknown, UIDataTypes>[];
  };
  console.log("Data: ", data);

  const result = streamText({
    model: wrapLanguageModel({
      model: gateway("groq/deepseek-r1-distill-llama-70b"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    experimental_transform: smoothStream({ delayInMs: 20, chunking: "word" }),
    messages: convertToModelMessages(data.messages),
  });

  const createChatPromise = (async () => {
    const { rowsAffected } = await db
      .insert(chat)
      .values({
        id: data.id,
        name: "New Chat",
        userId: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .execute();
    console.log("Inserted chat");
    return rowsAffected === 0;
  })().catch(console.error);

  (async () => {
    if ((await createChatPromise) === false) {
      console.log("Generating chat name");
      const { text } = await generateText({
        model: gateway("openai/gpt-4.1-nano"),
        system: `Your job is to provide a short title for the chat. The user will provide a message, and you will use that to create a very short name (1-3 words) for the chat.`,
        messages: convertToModelMessages(data.messages),
      });
      await db
        .update(chat)
        .set({ name: text })
        .where(eq(chat.id, data.id))
        .execute();
    }
  })().catch(console.error);

  //   console.log(result);
  //   await result.consumeStream();
  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    newMessageId: crypto.randomUUID(),
    onFinish: (finishData) => {
      console.log(finishData.messages);
      (async () => {
        await createChatPromise;
        await db
          .insert(message)
          .values(
            [...data.messages, ...finishData.messages].map((item, i) => ({
              ...item,
              order: i,
              chatId: data.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          )
          // .onConflictDoNothing({ target: [message.id] })
          .onConflictDoUpdate({
            target: [message.id],
            set: buildConflictUpdateColumns(message, [
              "metadata",
              "parts",
              "role",
            ]),
          })
          .execute();
      })().catch(console.error);
    },
  });
}
