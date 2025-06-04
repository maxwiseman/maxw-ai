"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Ellipsis } from "lucide-react";

import type { chat } from "@acme/db/schema";
import { authClient } from "@acme/auth/client";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@acme/ui/sidebar";

import { getChats } from "./chat-actions";

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
            {categorizedChats.today.map((chat) => (
              <Link key={chat.id} href={`/chats/${chat.id}`} tabIndex={-1}>
                <SidebarMenuItem>
                  <SidebarMenuButton className="line-clamp-1 break-all">
                    {chat.name}
                  </SidebarMenuButton>
                  <SidebarMenuAction showOnHover>
                    <Ellipsis />
                  </SidebarMenuAction>
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
            {categorizedChats.last7Days.map((chat) => (
              <Link key={chat.id} href={`/chats/${chat.id}`} tabIndex={-1}>
                <SidebarMenuItem>
                  <SidebarMenuButton className="line-clamp-1 break-all">
                    {chat.name}
                  </SidebarMenuButton>
                  <SidebarMenuAction showOnHover>
                    <Ellipsis />
                  </SidebarMenuAction>
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
            {categorizedChats.last30Days.map((chat) => (
              <Link key={chat.id} href={`/chats/${chat.id}`} tabIndex={-1}>
                <SidebarMenuItem>
                  <SidebarMenuButton className="line-clamp-1 break-all">
                    {chat.name}
                  </SidebarMenuButton>
                  <SidebarMenuAction showOnHover>
                    <Ellipsis />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              </Link>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  );
}

export const SidebarChats = dynamic(async () => SidebarChatsDynamic, {
  ssr: false,
});
