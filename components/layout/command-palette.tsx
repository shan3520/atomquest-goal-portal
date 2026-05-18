"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, FilePlus, FileText, Users, CheckCircle, Settings,
  BarChart3, Share2, Unlock, ScrollText, Bell, LogOut, Keyboard,
  Search, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface Command {
  id: string;
  label: string;
  group: "Navigate" | "Action";
  icon: typeof LayoutDashboard;
  /** Words that should match a search even if the label doesn't contain them. */
  keywords?: string[];
  /** Either a route (handled by router.push) or a callback. */
  href?: string;
  run?: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  role: Role | null;
  onSignOut: () => void;
  onShowShortcuts: () => void;
}

function buildCommands(
  role: Role | null,
  onSignOut: () => void,
  onShowShortcuts: () => void
): Command[] {
  const all: Command[] = [];

  // Employee
  if (role === "employee") {
    all.push(
      { id: "emp-dashboard", label: "Dashboard", group: "Navigate", icon: LayoutDashboard, href: "/dashboard" },
      { id: "emp-new", label: "Create new goal sheet", group: "Navigate", icon: FilePlus, href: "/goals/new", keywords: ["new", "create", "draft"] },
      { id: "emp-goals", label: "My goals", group: "Navigate", icon: FileText, href: "/goals" },
    );
  }

  // Manager
  if (role === "manager") {
    all.push(
      { id: "mgr-team", label: "Team", group: "Navigate", icon: LayoutDashboard, href: "/manager/dashboard", keywords: ["dashboard"] },
      { id: "mgr-checkins", label: "Team check-ins", group: "Navigate", icon: CheckCircle, href: "/manager/checkins" },
      { id: "mgr-shared", label: "Shared goals", group: "Navigate", icon: Share2, href: "/manager/shared-goals" },
    );
  }

  // Admin
  if (role === "admin") {
    all.push(
      { id: "adm-dashboard", label: "Admin dashboard", group: "Navigate", icon: LayoutDashboard, href: "/admin/dashboard" },
      { id: "adm-cycles", label: "Goal cycles", group: "Navigate", icon: Settings, href: "/admin/cycles" },
      { id: "adm-users", label: "Users", group: "Navigate", icon: Users, href: "/admin/users", keywords: ["people", "team", "members"] },
      { id: "adm-unlock", label: "Unlock goals", group: "Navigate", icon: Unlock, href: "/admin/goals/unlock" },
      { id: "adm-shared", label: "Shared goals", group: "Navigate", icon: Share2, href: "/admin/shared-goals" },
      { id: "adm-reports", label: "Reports", group: "Navigate", icon: BarChart3, href: "/admin/reports", keywords: ["csv", "export"] },
      { id: "adm-analytics", label: "Analytics", group: "Navigate", icon: BarChart3, href: "/admin/analytics", keywords: ["charts"] },
      { id: "adm-audit", label: "Audit trail", group: "Navigate", icon: ScrollText, href: "/admin/audit", keywords: ["log", "history"] },
      { id: "adm-escalations", label: "Escalations", group: "Navigate", icon: Bell, href: "/admin/escalations" },
    );
  }

  // Actions (every role)
  all.push(
    {
      id: "act-shortcuts",
      label: "View keyboard shortcuts",
      group: "Action",
      icon: Keyboard,
      keywords: ["help", "?", "kb"],
      run: onShowShortcuts,
    },
    {
      id: "act-signout",
      label: "Sign out",
      group: "Action",
      icon: LogOut,
      keywords: ["logout", "leave"],
      run: onSignOut,
    },
  );

  return all;
}

export function CommandPalette({
  open,
  onOpenChange,
  role,
  onSignOut,
  onShowShortcuts,
}: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const commands = useMemo(
    () => buildCommands(role, onSignOut, onShowShortcuts),
    [role, onSignOut, onShowShortcuts]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = [c.label, ...(c.keywords ?? [])].join(" ").toLowerCase();
      // simple substring; cheap, predictable, and sufficient for ~12 commands
      return hay.includes(q);
    });
  }, [commands, query]);

  // Reset state when reopening
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Defer focus to next paint so the input exists in the DOM
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep activeIdx in bounds as the filter changes
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0);
  }, [filtered, activeIdx]);

  function run(cmd: Command) {
    onOpenChange(false);
    if (cmd.href) {
      router.push(cmd.href);
    } else if (cmd.run) {
      cmd.run();
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIdx];
      if (cmd) run(cmd);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  }

  if (!open) return null;

  // Render groups in stable order: Navigate first, then Action
  const groups: Command["group"][] = ["Navigate", "Action"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      onKeyDown={handleKey}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        tabIndex={-1}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg rounded-xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a page or action"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            aria-label="Search commands"
            aria-controls="command-palette-list"
            aria-activedescendant={filtered[activeIdx] ? `cmd-${filtered[activeIdx].id}` : undefined}
          />
          <kbd className="text-[10px] tracking-wider uppercase text-muted-foreground/70 border border-border/60 rounded px-1.5 py-0.5 shrink-0">
            esc
          </kbd>
        </div>

        {/* Results */}
        <ul
          id="command-palette-list"
          role="listbox"
          aria-label="Commands"
          className="max-h-[50vh] overflow-y-auto py-1"
        >
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-sm text-muted-foreground text-center">
              Nothing matches &ldquo;{query}&rdquo;
            </li>
          )}
          {groups.map((group) => {
            const groupCmds = filtered.filter((c) => c.group === group);
            if (groupCmds.length === 0) return null;
            return (
              <li key={group} role="presentation">
                <p className="px-4 pt-2 pb-1 text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
                  {group}
                </p>
                <ul role="group">
                  {groupCmds.map((cmd) => {
                    const idx = filtered.indexOf(cmd);
                    const isActive = idx === activeIdx;
                    const Icon = cmd.icon;
                    return (
                      <li
                        key={cmd.id}
                        id={`cmd-${cmd.id}`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <button
                          type="button"
                          onClick={() => run(cmd)}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors",
                            isActive
                              ? "bg-primary/10 text-foreground"
                              : "text-foreground/85 hover:bg-card/70"
                          )}
                        >
                          <Icon
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isActive ? "text-primary" : "text-muted-foreground"
                            )}
                            aria-hidden
                          />
                          <span className="flex-1 truncate">{cmd.label}</span>
                          {isActive && (
                            <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/60 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="border border-border/60 rounded px-1">↑</kbd>
              <kbd className="border border-border/60 rounded px-1">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="border border-border/60 rounded px-1">↵</kbd>
              select
            </span>
          </span>
          <span className="text-muted-foreground/60">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </span>
        </div>
      </div>
    </div>
  );
}
