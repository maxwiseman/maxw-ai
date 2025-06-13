"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, Globe, Lock } from "lucide-react";

import { authClient } from "@acme/auth/client";
import { MagicIcon } from "@acme/ui/magic-icon";

import { getChatShare } from "~/app/components/chat-actions";
import { queryClient } from "~/app/components/query-client";

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
  return (
    <div className="flex size-full flex-col items-center justify-center gap-4">
      <div className="bg-muted overflow-hidden rounded-full p-4">
        <MagicIcon animationKey={animationStatus}>
          {animationStatus === "auth" && <Lock className="size-10" />}
          {animationStatus === "branching" && <GitBranch className="size-10" />}
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
}
