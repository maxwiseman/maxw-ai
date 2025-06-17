import type { UIDataTypes, UIMessage } from "ai";
import { headers } from "next/headers";
import { gateway } from "@vercel/ai-sdk-gateway";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  smoothStream,
  streamText,
} from "ai";

import { auth } from "@acme/auth";
import { buildConflictUpdateColumns, eq } from "@acme/db";
import { db } from "@acme/db/client";
import { chat, message } from "@acme/db/schema";

import type { ModelFeatureResponse, ModelId } from "~/lib/model-utils";
import { getProvider } from "~/lib/provider-utils";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const data = (await req.json()) as {
    id: string;
    model: ModelId;
    regenerate?: boolean;
    features?: ModelFeatureResponse;
    messages: UIMessage<unknown, UIDataTypes>[];
  };
  console.log("Data: ", data);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const modelOptions = getProvider(data.model, data.features);
      const result = streamText({
        ...modelOptions,
        experimental_transform: smoothStream({
          delayInMs: 20,
          chunking: "word",
        }),
        messages: convertToModelMessages(data.messages),
      });
      result.consumeStream().catch(console.error);

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

      const generateChatNamePromise = (async () => {
        if ((await createChatPromise) === false) {
          const { text } = await generateText({
            model: gateway("openai/gpt-4.1-nano"),
            system: `Your job is to provide a short title for the chat. The user will provide a message, and you will use that to create a very short name (1-3 words) for the chat.`,
            messages: convertToModelMessages(data.messages),
          });
          writer.write({
            type: "data-name",
            data: { chatName: text.split("\n")[0] },
          });
          await db
            .update(chat)
            .set({ name: text.split("\n")[0] })
            .where(eq(chat.id, data.id))
            .execute();
        }
      })().catch(console.error);

      writer.merge(
        result.toUIMessageStream({
          sendReasoning: true,
          sendSources: true,
          sendFinish: false,
          newMessageId: crypto.randomUUID(),
          originalMessages: data.messages,
          onFinish: (finishData) => {
            (async () => {
              console.log("Finish", finishData);
              await createChatPromise;
              if (data.regenerate) {
                await db
                  .delete(message)
                  .where(eq(message.chatId, data.id))
                  .execute();
              }
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
        }),
      );
      await generateChatNamePromise;
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
