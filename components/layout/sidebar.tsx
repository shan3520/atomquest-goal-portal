"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Target, LayoutDashboard, FilePlus, FileText,
  Users, CheckCircle, Settings, Shield, BarChart3,
  Share2, Unlock, ScrollText, Bell, ChevronLeft,
  ChevronRight, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Role } from "@/types";

interface SidebarProps {
  role: Role;
  userName: string;
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
}

const navItems: NavItem[] = [
  // Employee
  { title: "My Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["employee"] },
  { title: "New Goal Sheet", href: "/goals/new", icon: FilePlus, roles: ["employee"] },
  { title: "My Goals", href: "/goals", icon: FileText, roles: ["employee"] },
  // Manager
  { title: "Team Dashboard", href: "/manager/dashboard", icon: LayoutDashboard, roles: ["manager"] },
  { title: "Team Check-ins", href: "/manager/checkins", icon: CheckCircle, roles: ["manager"] },
  { title: "Team Shared Goals", href: "/manager/shared-goals", icon: Share2, roles: ["manager"] },
  // Admin
  { title: "Admin Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { title: "Goal Cycles", href: "/admin/cycles", icon: Settings, roles: ["admin"] },
  { title: "User Management", href: "/admin/users", icon: Users, roles: ["admin"] },
  { title: "Unlock Goals", href: "/admin/goals/unlock", icon: Unlock, roles: ["admin"] },
  { title: "Shared Goals", href: "/admin/shared-goals", icon: Share2, roles: ["admin"] },
  { title: "Reports", href: "/admin/reports", icon: BarChart3, roles: ["admin"] },
  { title: "Analytics", href: "/admin/analytics", icon: BarChart3, roles: ["admin"] },
  { title: "Audit Trail", href: "/admin/audit", icon: ScrollText, roles: ["admin"] },
  { title: "Escalations", href: "/admin/escalations", icon: Bell, roles: ["admin"] },
];

const roleBadgeColors: Record<Role, string> = {
  employee: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  manager: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  admin: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function Sidebar({ role, userName, collapsed, onToggle, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  // Pick the most specific match (longest href that the pathname starts with) so only
  // one nav item highlights at a time. Exact matches always win.
  const activeHref = (() => {
    const exact = filteredItems.find((i) => i.href === pathname);
    if (exact) return exact.href;
    return filteredItems
      .filter((i) => i.href !== "/" && pathname.startsWith(i.href + "/"))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  })();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <Target className="w-5 h-5 text-primary" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold gradient-text whitespace-nowrap">AtomQuest</h1>
            <p className="text-[10px] text-muted-foreground">Goal Portal</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {filteredItems.map((item) => {
          const isActive = item.href === activeHref;
          const Icon = item.icon;

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive && "text-primary")} />
              {!collapsed && <span className="truncate">{item.title}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                {/* render={link} makes TooltipTrigger render AS the <a> instead of wrapping it
                    in its default <button>. Avoids invalid <button><a/></button> nesting. */}
                <TooltipTrigger render={link} />
                <TooltipContent side="right">{item.title}</TooltipContent>
              </Tooltip>
            );
          }
          return link;
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User Info & Controls */}
      <div className="p-3 space-y-2 shrink-0">
        {!collapsed && (
          <div className="px-2 py-2">
            <p className="text-sm font-medium truncate">{userName}</p>
            <span className={cn("inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase", roleBadgeColors[role])}>
              {role}
            </span>
          </div>
        )}
        {collapsed ? (
          // Collapsed: icon-only buttons with tooltips
          <div className="flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    aria-label="Expand sidebar"
                    className="shrink-0 h-8 w-8"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                }
              />
              <TooltipContent side="right">Expand</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onLogout}
                    aria-label="Sign out"
                    className="shrink-0 h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                }
              />
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          // Expanded: full-width Sign Out button with text + a smaller Collapse control below
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              onClick={onLogout}
              className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
              Collapse sidebar
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
