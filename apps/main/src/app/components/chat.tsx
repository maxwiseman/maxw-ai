"use client";

import type { UIMessage } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { IconExclamationCircle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp,
  Check,
  Copy,
  MessageCircleDashed,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { marked } from "marked";
import { motion } from "motion/react";

import { authClient } from "@acme/auth/client";
import { Button } from "@acme/ui/button";
import { Card, CardContent, CardHeader } from "@acme/ui/card";
import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@acme/ui/chat-container";
import { cn } from "@acme/ui/index";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@acme/ui/message";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@acme/ui/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@acme/ui/reasoning";
import { ScrollButton } from "@acme/ui/scroll-button";

import { blurTransition } from "~/lib/transitions";
import { getChats } from "./chat-actions";
import { queryClient } from "./query-client";

export function DynamicChat() {
  const params = useParams();
  const chatFetch = useQuery({ queryFn: getChats, queryKey: ["chats"] });
  const newChatId = useMemo(() => crypto.randomUUID(), []);
  const authData = authClient.useSession();

  const [input, setInput] = useState("");
  const { messages, stop, status, error, sendMessage } = useChat({
    id: (params.chatId as string | undefined) ?? newChatId,
    messages:
      (chatFetch.data !== "Unauthorized" &&
      (authData.isPending || authData.data?.user)
        ? chatFetch.data?.find((chat) => chat.id === params.chatId)?.messages
        : undefined) ?? [],
    generateId: () => crypto.randomUUID(),
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: () => {
      queryClient
        .invalidateQueries({ queryKey: ["chats"] })
        .catch(console.error);
    },
  });

  const canSubmit = status === "ready" || status === "error";
  console.log("Messages", messages);

  return (
    <div className="absolute inset-0 h-full max-h-full overflow-hidden">
      <ChatContainerRoot className="absolute inset-0 overflow-scroll">
        <ChatContainerContent>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-8 pb-64 sm:px-8 lg:px-16">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                status={status}
                message={message}
                isLatest={message.id === messages[messages.length - 1]?.id}
                className={cn(
                  message.role === "user" ? "self-end" : "w-full grow",
                )}
              />
            ))}
            {messages.length === 0 && (
              <div className="absolute inset-0 flex w-full flex-col items-center justify-center gap-2 pb-32">
                <MessageCircleDashed className="size-10" />
                <p className="text-muted-foreground text-sm">No messages yet</p>
              </div>
            )}
            {error && (
              <motion.div {...blurTransition}>
                <Card className="border-amber-500/20 bg-amber-500/10 text-amber-500 shadow-none">
                  <CardHeader className="flex flex-row items-center gap-2 p-4 pb-0 text-lg font-medium">
                    <IconExclamationCircle />
                    {error.message}
                  </CardHeader>
                  <CardContent className="p-4 pt-2 text-sm">
                    {typeof error.cause === "string"
                      ? error.cause
                      : "We're sorry, but something went wrong."}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </ChatContainerContent>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 m-4 flex flex-col items-center justify-center gap-2 [&>*]:pointer-events-auto">
          <ScrollButton className="size-9" />
          <PromptInput
            value={input}
            onValueChange={setInput}
            onSubmit={canSubmit ? () => sendMessage({ text: input }) : stop}
            isLoading={canSubmit}
            className="w-full max-w-2xl"
          >
            <PromptInputTextarea placeholder="Ask me anything..." />
            <PromptInputActions className="justify-end pt-2">
              <PromptInputAction
                tooltip={canSubmit ? "Send message" : "Stop generation"}
              >
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => sendMessage({ text: input })}
                >
                  {canSubmit ? (
                    <ArrowUp className="!size-5" />
                  ) : (
                    <Square className="!size-5 fill-current" />
                  )}
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
      </ChatContainerRoot>
    </div>
  );
}

export function ChatMessage({
  message,
  status,
  isLatest,
  className,
}: {
  message: UIMessage;
  status: ChatStatus;
  isLatest: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [likeStatus, setLikeStatus] = useState<"liked" | "disliked" | "none">(
    "none",
  );

  return (
    <Message
      className={cn(className, "flex-col", {
        "max-w-[90%]": message.role === "user",
      })}
    >
      {message.parts.map((part, partIndex) => {
        const isGeneratingPart =
          status === "streaming" &&
          isLatest &&
          partIndex === message.parts.length - 1;
        switch (part.type) {
          case "reasoning":
            if (part.text.trim() !== "")
              return (
                <Reasoning
                  key={partIndex}
                  defaultOpen={false}
                  generating={isGeneratingPart}
                  className="text-muted-foreground"
                >
                  <ReasoningTrigger>
                    {isGeneratingPart ? "Thinking..." : "Thought about it"}
                  </ReasoningTrigger>
                  <ReasoningContent>
                    {part.text}
                    {isGeneratingPart && "●"}
                  </ReasoningContent>
                </Reasoning>
              );
            return null;
          case "text":
            return (
              <MessageContent
                key={partIndex}
                className={cn(
                  message.role !== "user" &&
                    "w-full rounded-none bg-transparent p-0 px-0",
                )}
                markdown
              >
                {part.text}
              </MessageContent>
            );
        }
      })}
      {message.role === "assistant" &&
        (!isLatest || status !== "streaming") && (
          <MessageActions>
            <MessageAction tooltip="Copy message">
              <Button
                onClick={async () => {
                  const html = await marked.parse(
                    message.parts
                      .map((p) => (p.type === "text" ? p.text : ""))
                      .join(""),
                  );
                  // await navigator.clipboard.writeText(
                  //   message.parts.find((part) => part.type === "text")?.text ??
                  //     "",
                  // );
                  await navigator.clipboard.write([
                    new ClipboardItem({
                      "text/html": new Blob([html], { type: "text/html" }),
                      "text/plain": new Blob(
                        [
                          message.parts
                            .map((p) => (p.type === "text" ? p.text : ""))
                            .join(""),
                        ],
                        { type: "text/plain" },
                      ),
                    }),
                  ]);
                  setCopied(true);
                  setTimeout(() => {
                    setCopied(false);
                  }, 3000);
                }}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                {copied ? (
                  <Check className={`!size-4`} />
                ) : (
                  <Copy className={`!size-4`} />
                )}
              </Button>
            </MessageAction>
            <MessageAction tooltip="Like message">
              <Button
                onClick={() =>
                  setLikeStatus(likeStatus === "liked" ? "none" : "liked")
                }
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                <ThumbsUp
                  fill={likeStatus === "liked" ? "currentColor" : "none"}
                  className={`!size-4`}
                />
              </Button>
            </MessageAction>
            <MessageAction tooltip="Dislike message">
              <Button
                onClick={() =>
                  setLikeStatus(likeStatus === "disliked" ? "none" : "disliked")
                }
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                <ThumbsDown
                  fill={likeStatus === "disliked" ? "currentColor" : "none"}
                  className={`!size-4`}
                />
              </Button>
            </MessageAction>
          </MessageActions>
        )}
    </Message>
  );
}
// eslint-disable-next-line @typescript-eslint/require-await -- dynamic requires an async function
export const Chat = dynamic(async () => DynamicChat, { ssr: false });
