import Link from "next/link";
import { ArrowUpRight, Gauge, Plane } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@acme/ui/sidebar";

import { AuthButton } from "./components/auth-modal";
import { SidebarChats } from "./components/sidebar-chats";

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
        <SidebarChats />
      </SidebarContent>
      <SidebarFooter>
        <AuthButton />
      </SidebarFooter>
    </Sidebar>
  );
}
