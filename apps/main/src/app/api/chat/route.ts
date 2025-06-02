import { headers } from "next/headers";
import { gateway } from "@vercel/ai-sdk-gateway";
import {
  convertToModelMessages,
  extractReasoningMiddleware,
  streamText,
  wrapLanguageModel,
} from "ai";

import { auth } from "@acme/auth";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const data = await req.json();
  //   console.log(data);

  const result = streamText({
    model: wrapLanguageModel({
      model: gateway("groq/deepseek-r1-distill-llama-70b"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    messages: convertToModelMessages(data.messages),
    onFinish: (message) => {
      console.log("Generated: ", message);
    },
    onError: (error) => {
      console.error(error);
    },
  });
  //   console.log(result);
  //   await result.consumeStream();
  return result.toUIMessageStreamResponse({ sendReasoning: true });
}
