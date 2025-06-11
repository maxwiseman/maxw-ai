"use client";

import type { UIMessage } from "@ai-sdk/react";
import type { ChatRequestOptions, ChatStatus } from "ai";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { redirect, useParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { IconExclamationCircle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp,
  Check,
  Copy,
  GitBranch,
  MessageCircleDashed,
  Paperclip,
  RefreshCw,
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
import { QuickLink } from "@acme/ui/quick-link";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@acme/ui/reasoning";
import { ScrollButton } from "@acme/ui/scroll-button";
import { toast } from "@acme/ui/toast";

import type { ModelFeatureResponse, ModelId } from "~/lib/model-utils";
import { models } from "~/lib/models";
import { blurTransition } from "~/lib/transitions";
import { branchOff, getChats } from "./chat-actions";
import { ModelPicker } from "./model-picker";
import { PromptInputSelect } from "./prompt-input-toggle";
import { queryClient } from "./query-client";

export function DynamicChat() {
  const params = useParams();
  const chatFetch = useQuery({ queryFn: getChats, queryKey: ["chats"] });
  const newChatId = useMemo(() => crypto.randomUUID(), []);
  const authData = authClient.useSession();

  const [input, setInput] = useState("");
  const [model, setModel] = useState<ModelId | undefined>("gpt-4.1-nano");
  const selectedModel = model ? models[model] : undefined;
  const [features, setFeatures] = useState<ModelFeatureResponse>();
  const { messages, stop, status, error, sendMessage, reload } = useChat({
    id: (params.chatId as string | undefined) ?? newChatId,
    messages:
      (chatFetch.data !== "Unauthorized" &&
      (authData.isPending || authData.data?.user)
        ? chatFetch.data?.find((chat) => chat.id === params.chatId)?.messages
        : undefined) ?? [],
    generateId: () => crypto.randomUUID(),
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
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
                chatId={params.chatId as string}
                status={status}
                message={message}
                isLatest={message.id === messages[messages.length - 1]?.id}
                className={cn(
                  message.role === "user" ? "self-end" : "w-full grow",
                )}
                reload={reload}
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
                <Card className="gap-2 border-amber-500/20 bg-amber-500/10 text-amber-500 shadow-none">
                  <CardHeader className="flex flex-row items-center gap-2 pb-0 text-lg font-medium">
                    <IconExclamationCircle className="shrink-0" />
                    {error.message === "" ? "Unknown Error" : error.message}
                  </CardHeader>
                  <CardContent className="text-sm text-amber-500/80">
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
            onSubmit={
              canSubmit
                ? async () => {
                    setInput("");
                    await sendMessage(
                      { text: input },
                      { body: { model, features } },
                    );
                  }
                : stop
            }
            isLoading={canSubmit}
            className="w-full max-w-2xl"
          >
            <PromptInputTextarea placeholder="Ask me anything..." />
            <PromptInputActions className="justify-between pt-2">
              <div className="flex items-center gap-2">
                <PromptInputAction tooltip={"Upload file"}>
                  <Button
                    className="rounded-full"
                    variant="outline"
                    size="icon"
                  >
                    <Paperclip className="!size-4" />
                  </Button>
                </PromptInputAction>
                {selectedModel?.features?.map((feat) => (
                  <PromptInputSelect
                    key={feat.id}
                    feature={feat}
                    onValueChange={(value) => {
                      setFeatures({ ...features, [feat.id]: value });
                    }}
                    iconOnly={false}
                  />
                ))}
                {/* {selectedModel?.features?.map((feat) => (
                  <PromptInputToggle
                    key={feat.id}
                    type="toggle"
                    label={feat.display.label}
                    tooltip={feat.display.tooltip}
                  >
                    <feat.display.icon />
                  </PromptInputToggle>
                ))} */}
                {/* <PromptInputToggle
                  value={features.think}
                  onValueChange={(value) => {
                    setFeatures({ ...features, think: value });
                  }}
                  features={["think/optional"]}
                  force={["think"]}
                  tooltip={"Think for longer"}
                  label={"Think"}
                  model={selectedModel}
                >
                  <Brain />
                </PromptInputToggle>
                <PromptInputToggle
                  value={features.search}
                  onValueChange={(value) => {
                    setFeatures({ ...features, search: value });
                  }}
                  features={["search/optional"]}
                  force={["search"]}
                  tooltip={"Search the web"}
                  label={"Search"}
                  model={selectedModel}
                >
                  <Globe />
                </PromptInputToggle> */}
                <div />
              </div>
              <div className="flex items-center gap-2">
                <PromptInputAction tooltip={"Change model"}>
                  <ModelPicker value={model} onValueChange={setModel} />
                </PromptInputAction>
                <PromptInputAction
                  tooltip={canSubmit ? "Send message" : "Stop generation"}
                >
                  <Button
                    variant="default"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={async () => {
                      setInput("");
                      await sendMessage(
                        { text: input },
                        { body: { model, features } },
                      );
                    }}
                  >
                    {canSubmit ? (
                      <ArrowUp className="!size-5" />
                    ) : (
                      <Square className="!size-5 fill-current" />
                    )}
                  </Button>
                </PromptInputAction>
              </div>
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
  reload,
  chatId,
}: {
  message: UIMessage;
  status: ChatStatus;
  isLatest: boolean;
  reload: (options?: ChatRequestOptions) => void;
  chatId: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [likeStatus, setLikeStatus] = useState<"liked" | "disliked" | "none">(
    "none",
  );
  const notLatestParts = ["data-name", "data-branch"];

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
          partIndex ===
            message.parts.filter((part) => !notLatestParts.includes(part.type))
              .length -
              1;
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
            {isLatest && (
              <MessageAction tooltip="Regenerate">
                <Button
                  onClick={() => {
                    reload({ body: { regenerate: true } });
                  }}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <RefreshCw className={`!size-4`} />
                </Button>
              </MessageAction>
            )}
            <MessageAction tooltip="Branch off">
              <Button
                onClick={async () => {
                  const branchOffMutation = await branchOff(chatId, message.id);
                  if (branchOffMutation.status !== "error") {
                    await queryClient.invalidateQueries({
                      queryKey: ["chats"],
                    });
                    redirect(`/chats/${branchOffMutation.newChatId}`);
                  } else {
                    toast.error(branchOffMutation.message);
                  }
                }}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                <GitBranch className={`!size-4`} />
              </Button>
            </MessageAction>
            <MessageAction tooltip="Copy">
              <Button
                onClick={async () => {
                  const html = await marked.parse(
                    message.parts
                      .map((p) => (p.type === "text" ? p.text : ""))
                      .join(""),
                  );
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

            <MessageAction tooltip="Like">
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
            <MessageAction tooltip="Dislike">
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
      {(() => {
        const branchPart = message.parts.find(
          (part) => part.type === "data-branch",
        ) as
          | {
              type: "data-branch";
              data: { fromChatId: string; fromChatName: string };
            }
          | undefined;
        if (!branchPart) return null;
        const { fromChatId, fromChatName } = branchPart.data;
        return (
          <div className="text-muted-foreground mt-8 flex items-center justify-center gap-2">
            <GitBranch className="!size-4" />
            <div>
              Branched off from{" "}
              <QuickLink
                className="decoration-muted-foreground/40 inline underline"
                href={`/chats/${fromChatId}`}
              >
                {fromChatName}
              </QuickLink>
            </div>
          </div>
        );
      })()}
    </Message>
  );
}
// eslint-disable-next-line @typescript-eslint/require-await -- dynamic requires an async function
export const Chat = dynamic(async () => DynamicChat, { ssr: false });
