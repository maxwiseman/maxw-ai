"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Ellipsis } from "lucide-react";

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
  const { data } = useQuery({
    queryKey: ["chats"],
    queryFn: getChats,
  });

  if (data === "Unauthorized") return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Today</SidebarGroupLabel>
      <SidebarMenu>
        {data?.map((chat) => (
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
  );
}

export const SidebarChats = dynamic(async () => SidebarChatsDynamic, {
  ssr: false,
});
