"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpLeft, Briefcase, Building2, LayoutDashboard, Library, LifeBuoy, Route, Settings, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Brand } from "@/components/Brand";

interface HireShellProps {
  children: React.ReactNode;
  org: { name: string; slug: string };
  roleLabel: string;
  user: { email: string; name: string | null };
  /** Set when an operator is viewing on a support grant. */
  support: { expiresAt: string; reason: string } | null;
  /** More than one workspace: show a link back to the picker. */
  canSwitch: boolean;
  /** Nav items this viewer may open, decided on the server from their role. */
  nav: HireNavKey[];
}

export type HireNavKey = "overview" | "roles" | "candidates" | "loops" | "questions" | "team" | "settings";

const NAV: Record<HireNavKey, { label: string; path: string; icon: LucideIcon }> = {
  overview: { label: "Overview", path: "", icon: LayoutDashboard },
  roles: { label: "Roles", path: "/roles", icon: Briefcase },
  candidates: { label: "Candidates", path: "/candidates", icon: UserCheck },
  loops: { label: "Loops", path: "/loops", icon: Route },
  questions: { label: "Questions", path: "/questions", icon: Library },
  team: { label: "Team", path: "/team", icon: Users },
  settings: { label: "Settings", path: "/settings", icon: Settings },
};

export function HireShell({ children, org, roleLabel, user, support, canSwitch, nav }: HireShellProps) {
  const pathname = usePathname();
  const base = `/hire/${org.slug}`;
  const items = nav.map((key) => NAV[key]).map((n) => {
    const href = base + n.path;
    return { ...n, href, active: n.path ? pathname?.startsWith(href) : pathname === base };
  });

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-bg-elevated/40">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
          <Link href={base} aria-label={`${org.name} workspace`}>
            <Brand compact />
          </Link>
          <span className="text-[10px] uppercase tracking-[0.14em] text-accent">hire</span>
        </div>
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 text-text-dim shrink-0" />
            <span className="text-sm font-medium truncate">{org.name}</span>
          </div>
          <div className="text-xs text-text-dim mt-0.5 pl-6">{roleLabel}</div>
          {canSwitch && (
            <Link href="/hire" className="text-xs text-text-muted hover:text-text pl-6">
              Switch workspace
            </Link>
          )}
        </div>
        <nav className="p-2 flex-1 space-y-0.5">
          {items.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  n.active ? "bg-bg-surface text-text" : "text-text-muted hover:text-text hover:bg-bg-surface/60"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 space-y-2">
          <div className="text-xs text-text-dim leading-tight">
            <div className="font-medium text-text-muted truncate">{user.name || "Signed in"}</div>
            <div className="truncate">{user.email}</div>
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text">
            <ArrowUpLeft className="h-3.5 w-3.5" /> Practice
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {support && (
          <div role="status" className="bg-hard/10 border-b border-hard/40 text-sm px-4 py-2 flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-hard shrink-0" />
            <span className="min-w-0">
              <strong>Support access</strong> (read-only) until{" "}
              {new Date(support.expiresAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. Reason: {support.reason}
            </span>
          </div>
        )}
        <header className="lg:hidden h-12 flex items-center gap-2 px-4 border-b border-border bg-bg/85 backdrop-blur sticky top-0 z-10">
          <Link href={base} aria-label={`${org.name} workspace`}>
            <Brand compact />
          </Link>
          <span className="text-sm font-medium truncate">{org.name}</span>
          <Link href="/dashboard" className="ml-auto text-xs text-text-muted hover:text-text inline-flex items-center gap-1">
            <ArrowUpLeft className="h-3.5 w-3.5" /> Practice
          </Link>
        </header>
        <nav className="lg:hidden border-b border-border bg-bg-elevated/30 px-3 py-2 overflow-x-auto flex gap-1 text-sm">
          {items.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md whitespace-nowrap ${
                  n.active ? "bg-bg-surface text-text" : "text-text-muted hover:text-text"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 min-w-0 p-6 lg:p-8 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
