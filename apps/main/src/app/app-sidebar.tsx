import { ArrowUpRight, Gauge, Plane } from "lucide-react";

import { AuthButton } from "@acme/ui/auth-modal";
import { QuickLink } from "@acme/ui/quick-link";
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

import { env } from "~/env";
import { SidebarChats } from "./components/sidebar-chats";

export function AppSidebar() {
  const externalLinks = [
    {
      href: `https://rapidgrader.${env.VERCEL_PROJECT_PRODUCTION_URL}`,
      label: "RapidGrader",
      icon: Gauge,
    },
    {
      href: `https://autopilot.${env.VERCEL_PROJECT_PRODUCTION_URL}`,
      label: "AutoPilot",
      icon: Plane,
    },
  ];

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <QuickLink
          prefetch={true}
          href="/"
          className="mb-4 font-mono text-2xl font-bold"
        >
          maxw.ai
        </QuickLink>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {externalLinks.map((externalLink) => (
            <QuickLink
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
            </QuickLink>
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
