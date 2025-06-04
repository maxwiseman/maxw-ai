import type { UIDataTypes, UIMessage } from "ai";
import { headers } from "next/headers";
import { gateway } from "@vercel/ai-sdk-gateway";
import {
  convertToModelMessages,
  extractReasoningMiddleware,
  smoothStream,
  streamText,
  wrapLanguageModel,
} from "ai";

import { auth } from "@acme/auth";
import { db } from "@acme/db/client";
import { message } from "@acme/db/schema";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const data = (await req.json()) as {
    chatId: string;
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

  //   console.log(result);
  //   await result.consumeStream();
  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    onFinish: (finishData) => {
      console.log(finishData.messages);
      db.insert(message)
        .values([
          ...finishData.messages.map((item) => ({
            ...item,
            chatId: data.chatId,
          })),
        ])
        .execute()
        .catch(console.error);
    },
  });
}
