"use client";

import type { UIMessage } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { useState } from "react";
import { createChatStore, useChat } from "@ai-sdk/react";
import { IconExclamationCircle } from "@tabler/icons-react";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp,
  Check,
  Copy,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

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

const chatStore = createChatStore({
  maxSteps: 5,
  chats: {
    "1": {
      messages: [
        {
          id: "1",
          role: "user",
          parts: [{ type: "text", text: "Hello, how are you?" }],
        },
        {
          id: "2",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "I am doing very well. How about `you`?",
            },
          ],
        },
        {
          id: "3",
          role: "user",
          parts: [
            {
              type: "text",
              text: "Could you show me some markdown formatting?",
            },
          ],
        },
        {
          id: "4",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `Sure thing:

# Heading 1

## Heading 2

### Heading 3

**Bold**
*Italic*
***Bold + Italic***
~~Strikethrough~~

> Blockquote
> Still part of the quote

* Bullet list item 1
* Bullet list item 2

  * Nested item

1. Numbered item 1
2. Numbered item 2

\`Inline code\`

\`\`\`tsx
<div>
  <h1>Hello, world!</h1>
</div>
\`\`\`

[Link to OpenAI](https://openai.com)

| Column A | Column B |
| -------- | -------- |
| Row 1    | Value 1  |
| Row 2    | Value 2  |

---

Let me know if you want specific styles or combos.
`,
            },
          ],
        },
        {
          id: "5",
          role: "user",
          parts: [{ type: "text", text: "Write an essay for me." }],
        },
        {
          id: "6",
          role: "assistant",
          parts: [
            {
              type: "reasoning",
              text: "I thought about it for a while and I think I can do it.",
            },
            {
              type: "text",
              text: `**Rainbow Six Siege: A Tactical Revolution in FPS Gaming**

*Tom Clancy’s Rainbow Six Siege* is a competitive first-person shooter that stands out for its emphasis on strategy, teamwork, and destruction-based gameplay. Unlike most run-and-gun shooters, *Siege* forces players to think like operators—planning, coordinating, and adapting in real time.

At its core, *Siege* pits two teams against each other: attackers and defenders. Each player chooses a unique operator with specific gadgets that shape the game’s tactical flow. Attackers might use drones, hard breaching tools, or smokescreens, while defenders set traps, reinforce walls, or gather intel. This asymmetric design creates a chess-like tension where every decision counts.

A major innovation in *Siege* is its destructible environments. Players can breach walls, floors, and ceilings to gain new lines of sight or surprise enemies. This dynamic map interaction adds depth, rewarding creativity and map knowledge over pure reflexes.

The game also thrives on communication. Solo play is possible, but coordinated teams dominate. Whether it’s a well-timed breach or a clutch 1v3 defense, the best moments in *Siege* come from teamwork and smart plays, not just aim.

Since its 2015 launch, *Siege* has evolved with frequent updates, new operators, and reworked maps. Despite its steep learning curve, its depth keeps players hooked. For those looking for a tactical, high-stakes shooter that rewards brains as much as brawn, *Rainbow Six Siege* delivers like no other.
`,
            },
          ],
        },
      ],
    },
  },
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});

export default function Chat({ chatId }: { chatId?: string }) {
  const { messages, handleSubmit, stop, setInput, input, status, error } =
    useChat({
      chatStore: chatStore,
      chatId: chatId ?? "1",
    });
  const canSubmit = status === "ready" || status === "error";
  console.log(messages);

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
            {error && (
              <Card className="border-amber-500/70 bg-amber-500/10 text-amber-500 shadow-none">
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
            )}
          </div>
        </ChatContainerContent>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 m-4 flex flex-col items-center justify-center gap-2 [&>*]:pointer-events-auto">
          <ScrollButton className="size-9" />
          <PromptInput
            value={input}
            onValueChange={setInput}
            onSubmit={canSubmit ? handleSubmit : stop}
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
                  onClick={handleSubmit}
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
            return (
              <Reasoning
                key={partIndex}
                defaultOpen={false}
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
      {message.role === "assistant" && (
        <MessageActions>
          <MessageAction tooltip="Copy message">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(
                  message.parts.find((part) => part.type === "text")?.text ||
                    "",
                );
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
