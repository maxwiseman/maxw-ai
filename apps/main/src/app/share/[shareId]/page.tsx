"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, Globe, Lock } from "lucide-react";

import { authClient } from "@acme/auth/client";
import { MagicIcon } from "@acme/ui/magic-icon";

import { ChatMessage } from "~/app/components/chat";
import { getChatShare } from "~/app/components/chat-actions";
import { queryClient } from "~/app/components/query-client";
import { cn } from "~/lib/utils";

export default function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const shareId = use(params).shareId;
  const authData = authClient.useSession();
  const chatData = useQuery({
    queryKey: ["chat-share", `chat-share-${shareId}`],
    queryFn: () => getChatShare(shareId),
  });
  const router = useRouter();

  useEffect(() => {
    if (chatData.data?.status === "branched") {
      queryClient
        .invalidateQueries({ queryKey: ["chats"] })
        .then(() => {
          console.log("redirecting");
          router.replace(`/chats/${chatData.data?.newChatId}`);
        })
        .catch(console.error);
    }
  }, [chatData.data, router]);

  const animationStatus = authData.isPending
    ? "auth"
    : authData.data
      ? "branching"
      : "fetching";
  if (chatData.isLoading || chatData.data?.status !== "found")
    return (
      <div className="flex size-full flex-col items-center justify-center gap-4">
        <div className="bg-muted overflow-hidden rounded-full p-4">
          <MagicIcon animationKey={animationStatus}>
            {animationStatus === "auth" && <Lock className="size-10" />}
            {animationStatus === "branching" && (
              <GitBranch className="size-10" />
            )}
            {animationStatus === "fetching" && <Globe className="size-10" />}
          </MagicIcon>
        </div>
        <h1 className="text-2xl font-bold">
          {animationStatus === "auth" && "Authenticating..."}
          {animationStatus === "branching" && "Branching chat..."}
          {animationStatus === "fetching" && "Fetching chat..."}
        </h1>
      </div>
    );
  return (
    <div className="absolute inset-0">
      <div className="size-full max-h-full overflow-y-scroll">
        <div className="bg-background/80 sticky top-0 flex w-full items-center justify-center border-b p-1 backdrop-blur">
          <div className="w-full max-w-3xl px-4 sm:px-8 lg:px-16">
            <div className="flex flex-col">
              <h1 className="line-clamp-1 text-lg font-bold">
                {chatData.data.chat?.name}
              </h1>
              <p className="text-muted-foreground text-sm">
                {`By ${chatData.data.chat?.user.name} ⋅ ${chatData.data.chat?.createdAt ? (typeof chatData.data.chat.createdAt === "string" ? new Date(chatData.data.chat.createdAt) : chatData.data.chat.createdAt).toLocaleDateString() : "Unknown date"}`}
              </p>
            </div>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-8 pb-24 sm:px-8 lg:px-16">
          {chatData.data.chat?.messages.map((message) => (
            <ChatMessage
              readOnly
              key={message.id}
              message={message}
              status="ready"
              isLatest={true}
              reload={() => {}}
              chatId={chatData.data?.chat?.id ?? ""}
              className={cn(
                message.role === "user" ? "self-end" : "w-full grow",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
