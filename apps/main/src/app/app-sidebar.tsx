import Link from "next/link";
import { IconBrandSpeedtest } from "@tabler/icons-react";
import {
  ArrowUpRight,
  Ellipsis,
  ExternalLink,
  Gauge,
  Plane,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@acme/ui/sidebar";

export function AppSidebar() {
  const externalLinks = [
    {
      href: "https://rapidgrader.maxw.ai",
      label: "RapidGrader",
      icon: Gauge,
    },
    {
      href: "https://autopilot.maxw.ai",
      label: "AutoPilot",
      icon: Plane,
    },
  ];

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <Link href="/" className="mb-4 font-mono text-2xl font-bold">
          maxw.ai
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {externalLinks.map((externalLink) => (
            <Link
              href={externalLink.href}
              target="_blank"
              key={externalLink.href}
              tabIndex={-1}
            >
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <externalLink.icon />
                  {externalLink.label}
                </SidebarMenuButton>
                <SidebarMenuAction
                  className="pointer-events-none"
                  showOnHover
                  tabIndex={-1}
                >
                  <ArrowUpRight />
                </SidebarMenuAction>
              </SidebarMenuItem>
            </Link>
          ))}
        </SidebarMenu>
        <SidebarGroup>
          <SidebarGroupLabel>Today</SidebarGroupLabel>
          <SidebarMenu>
            <Link href="/chats/1" tabIndex={-1}>
              <SidebarMenuItem>
                <SidebarMenuButton className="line-clamp-1 break-all">
                  Conversation about the meaning of life
                </SidebarMenuButton>
                <SidebarMenuAction showOnHover>
                  <Ellipsis />
                </SidebarMenuAction>
              </SidebarMenuItem>
            </Link>
            <Link href="/chats/2" tabIndex={-1}>
              <SidebarMenuItem>
                <SidebarMenuButton className="line-clamp-1 break-all">
                  New chat
                </SidebarMenuButton>
                <SidebarMenuAction showOnHover>
                  <Ellipsis />
                </SidebarMenuAction>
              </SidebarMenuItem>
            </Link>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
