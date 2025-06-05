"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Ellipsis, Globe, Lock, Trash2 } from "lucide-react";

import type { chat } from "@acme/db/schema";
import { authClient } from "@acme/auth/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@acme/ui/sidebar";

import { deleteChat, getChats } from "./chat-actions";
import { queryClient } from "./query-client";

function SidebarChatsDynamic() {
  const { data, refetch } = useQuery({
    queryKey: ["chats"],
    queryFn: getChats,
  });
  const authData = authClient.useSession();
  useEffect(() => {
    refetch().catch(console.error);
  }, [authData.data?.user.id, refetch]);

  if (data === "Unauthorized") return null;

  type Chat = typeof chat.$inferSelect;
  interface CategorizedChats {
    today: Chat[];
    last7Days: Chat[];
    last30Days: Chat[];
  }

  const categorizedChats = data?.reduce<CategorizedChats>(
    (acc, chat) => {
      const then = new Date(chat.updatedAt ?? chat.createdAt).getTime();
      const now = new Date().getTime();
      const msIn24h = 24 * 60 * 60 * 1000;
      const msIn7Days = 7 * msIn24h;
      const msIn30Days = 30 * msIn24h;

      if (now - then <= msIn24h && then <= now) {
        acc.today.push(chat);
      } else if (now - then <= msIn7Days && then <= now) {
        acc.last7Days.push(chat);
      } else if (now - then <= msIn30Days && then <= now) {
        acc.last30Days.push(chat);
      }
      return acc;
    },
    { today: [], last7Days: [], last30Days: [] },
  );

  if (!categorizedChats) return null;

  return (
    <>
      {categorizedChats.today.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Today</SidebarGroupLabel>
          <SidebarMenu>
            {categorizedChats.today
              .sort(
                (a, b) =>
                  new Date(b.updatedAt ?? b.createdAt).getTime() -
                  new Date(a.updatedAt ?? a.createdAt).getTime(),
              )
              .map((chat) => (
                <Link
                  prefetch={true}
                  key={chat.id}
                  href={`/chats/${chat.id}`}
                  tabIndex={-1}
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton className="line-clamp-1 break-all">
                      {chat.name}
                    </SidebarMenuButton>
                    {/* <SidebarMenuAction showOnHover>
                      <Ellipsis />
                    </SidebarMenuAction> */}
                    <SidebarChatDropdown chatId={chat.id} />
                  </SidebarMenuItem>
                </Link>
              ))}
          </SidebarMenu>
        </SidebarGroup>
      )}

      {categorizedChats.last7Days.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Last 7 Days</SidebarGroupLabel>
          <SidebarMenu>
            {categorizedChats.last7Days
              .sort(
                (a, b) =>
                  new Date(b.updatedAt ?? b.createdAt).getTime() -
                  new Date(a.updatedAt ?? a.createdAt).getTime(),
              )
              .map((chat) => (
                <Link
                  prefetch={true}
                  key={chat.id}
                  href={`/chats/${chat.id}`}
                  tabIndex={-1}
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton className="line-clamp-1 break-all">
                      {chat.name}
                    </SidebarMenuButton>
                    {/* <SidebarMenuAction showOnHover>
                      <Ellipsis />
                    </SidebarMenuAction> */}
                    <SidebarChatDropdown chatId={chat.id} />
                  </SidebarMenuItem>
                </Link>
              ))}
          </SidebarMenu>
        </SidebarGroup>
      )}

      {categorizedChats.last30Days.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Last 30 Days</SidebarGroupLabel>
          <SidebarMenu>
            {categorizedChats.last30Days
              .sort(
                (a, b) =>
                  new Date(b.updatedAt ?? b.createdAt).getTime() -
                  new Date(a.updatedAt ?? a.createdAt).getTime(),
              )
              .map((chat) => (
                <Link
                  prefetch={true}
                  key={chat.id}
                  href={`/chats/${chat.id}`}
                  tabIndex={-1}
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton className="line-clamp-1 break-all">
                      {chat.name}
                    </SidebarMenuButton>
                    {/* <SidebarMenuAction showOnHover>
                      <Ellipsis />
                    </SidebarMenuAction> */}
                    <SidebarChatDropdown chatId={chat.id} />
                  </SidebarMenuItem>
                </Link>
              ))}
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/require-await
export const SidebarChats = dynamic(async () => SidebarChatsDynamic, {
  ssr: false,
});

export function SidebarChatDropdown({ chatId }: { chatId: string }) {
  const params = useParams();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction showOnHover>
          <Ellipsis />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-36" side="right" align="start">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe className="text-muted-foreground mr-2 !size-4" />
            Sharing
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>
              <Globe className="!size-4" /> Public
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Lock /> Private
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          onClick={async () => {
            await deleteChat(chatId);
            await queryClient.invalidateQueries({ queryKey: ["chats"] });
            if (params.chatId === chatId) {
              router.push("/");
            }
          }}
        >
          <Trash2 className="!size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
