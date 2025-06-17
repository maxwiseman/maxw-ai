"use client";

import type { UIMessage } from "@ai-sdk/react";
import type { ChatRequestOptions, ChatStatus } from "ai";
import { useMemo, useRef, useState } from "react";
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
  File,
  GitBranch,
  MessageCircleDashed,
  Paperclip,
  RefreshCw,
  Square,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { marked } from "marked";
import { motion } from "motion/react";

import { authClient } from "@acme/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@acme/ui/avatar";
import { Button } from "@acme/ui/button";
import { Card, CardContent, CardHeader } from "@acme/ui/card";
import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@acme/ui/chat-container";
import { cn } from "@acme/ui/index";
import { MagicIcon } from "@acme/ui/magic-icon";
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
import { defaultModel, models } from "~/lib/models";
import { blurTransition } from "~/lib/transitions";
import { fileToFileUIPart } from "~/lib/utils";
import { branchOff, getChats } from "./chat-actions";
import { ChatShareModal } from "./chat-share-modal";
import { ModelPicker } from "./model-picker";
import { PromptInputSelect } from "./prompt-input-toggle";
import { queryClient } from "./query-client";
import { SourceDetails } from "./source-details";

export function DynamicChat() {
  const params = useParams();
  const chatFetch = useQuery({ queryFn: getChats, queryKey: ["chats"] });
  const chatData =
    chatFetch.data !== "Unauthorized"
      ? chatFetch.data?.find((chat) => chat.id === params.chatId)
      : undefined;
  const newChatId = useMemo(() => crypto.randomUUID(), []);
  const authData = authClient.useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [model, setModel] = useState<ModelId | undefined>(defaultModel);
  const selectedModel = model ? models[model] : undefined;
  const [features, setFeatures] = useState<ModelFeatureResponse>();
  const { messages, stop, status, error, sendMessage, reload } = useChat({
    id: (params.chatId as string | undefined) ?? newChatId,
    messages:
      (chatFetch.data !== "Unauthorized" &&
      (authData.isPending || authData.data?.user)
        ? chatData?.messages
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
  const submit = async () => {
    setInput("");
    setFiles([]);
    await sendMessage(
      {
        text: input,
        files: await Promise.all(files.map(fileToFileUIPart)),
      },
      { body: { model, features } },
    );
  };
  console.log("Messages", messages);

  return (
    <div className="absolute inset-0 h-full max-h-full">
      <ChatContainerRoot className="absolute inset-0 overflow-scroll">
        <ChatContainerContent>
          <div className="bg-background/80 sticky inset-x-0 top-0 z-5 flex items-center justify-between border-b p-4 backdrop-blur lg:absolute lg:border-none lg:bg-transparent lg:backdrop-blur-none">
            <div />
            <ChatShareModal
              chatId={(params.chatId as string | undefined) ?? ""}
            />
          </div>
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
          <div className="flex w-full max-w-2xl gap-2 overflow-x-scroll">
            {files.map((file) => (
              <div key={file.name} className="bg-background rounded-full">
                <div className="bg-background dark:bg-input/30 line-clamp-1 flex cursor-default items-center gap-1 rounded-full border p-1 px-3 pr-1 shadow-md/2">
                  <div className="truncate">{file.name}</div>
                  <Button
                    className="size-auto rounded-full !p-1"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFiles(files.filter((f) => f.name !== file.name));
                    }}
                  >
                    <X className="!size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <PromptInput
            value={input}
            onValueChange={setInput}
            onSubmit={
              canSubmit
                ? async () => {
                    await submit();
                  }
                : stop
            }
            isLoading={canSubmit}
            className="w-full max-w-2xl"
          >
            <PromptInputTextarea placeholder="Ask me anything..." />
            <PromptInputActions className="justify-between pt-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  multiple
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files ?? []));
                  }}
                />
                <PromptInputAction tooltip={"Upload file"}>
                  <Button
                    className="rounded-full"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
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
                      await submit();
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
  readOnly = false,
  message,
  status,
  isLatest,
  className,
  reload,
  chatId,
}: {
  readOnly?: boolean;
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
  const notLatestParts = ["data-name", "data-branch", "source-url"];
  const sources = message.parts.filter((part) => part.type === "source-url");

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
          case "file":
            if (part.mediaType.startsWith("image/"))
              return (
                <div className="self-end" key={partIndex}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="max-h-64 max-w-64 rounded-md border"
                    src={part.url}
                    alt={(part as unknown as { name: string }).name}
                  />
                </div>
              );
            return (
              <div
                className="bg-muted flex gap-3 self-end rounded-lg p-4 pr-5"
                key={partIndex}
              >
                <File className="!size-10" />
                <div className="flex flex-col">
                  <div className="line-clamp-1 max-w-64 font-medium">
                    {(part as unknown as { name: string }).name}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {part.mediaType}
                  </div>
                </div>
              </div>
            );
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
        (!isLatest || status !== "streaming") &&
        !readOnly && (
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
                  }, 2000);
                }}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                <MagicIcon animationKey={copied ? "copied" : "not-copied"}>
                  {copied ? (
                    <Check className={`!size-4`} />
                  ) : (
                    <Copy className={`!size-4`} />
                  )}
                </MagicIcon>
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
            {sources.length > 0 && (
              <SourceDetails sources={sources}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="group flex h-8 w-auto gap-2 rounded-full px-2"
                >
                  <div className="*:data-[slot=avatar]:ring-background *:data-[slot=avatar]:ring-background flex -space-x-1 *:data-[slot=avatar]:ring-2">
                    {sources.slice(0, 3).map((source) => (
                      <Avatar className="size-4" key={source.url}>
                        <AvatarImage
                          className="bg-background object-contain"
                          src={`https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=64`}
                        />
                        <AvatarFallback>
                          {source.title?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <div>Sources</div>
                </Button>
              </SourceDetails>
            )}
          </MessageActions>
        )}
      {(() => {
        const branchPart = message.parts.find(
          (part) => part.type === "data-branch",
        ) as
          | {
              type: "data-branch";
              data: {
                fromChatId?: string;
                fromChatName?: string;
                fromUser?: string;
              };
            }
          | undefined;
        if (!branchPart) return null;
        const { fromChatId, fromChatName, fromUser } = branchPart.data;
        return (
          <div className="text-muted-foreground mt-8 flex items-center justify-center gap-2">
            <GitBranch className="!size-4" />
            <div>
              Branched off from{" "}
              {fromChatId && fromChatName ? (
                <QuickLink
                  className="decoration-muted-foreground/40 inline underline"
                  href={`/chats/${fromChatId}`}
                >
                  {fromChatName}
                </QuickLink>
              ) : fromUser ? (
                <span>{`${fromUser}'s chat`}</span>
              ) : null}
            </div>
          </div>
        );
      })()}
    </Message>
  );
}
// eslint-disable-next-line @typescript-eslint/require-await -- dynamic requires an async function
export const Chat = dynamic(async () => DynamicChat, { ssr: false });
