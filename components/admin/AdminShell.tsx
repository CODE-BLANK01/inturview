"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Database,
  Activity,
  ScrollText,
  ArrowUpLeft,
  ShieldCheck,
} from "lucide-react";

interface AdminShellProps {
  children: React.ReactNode;
  user: { email: string; name: string | null };
}

const NAV = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Problems", href: "/admin/problems", icon: Database },
  { label: "Interviews", href: "/admin/interviews", icon: Activity },
  { label: "Audit log", href: "/admin/audit", icon: ScrollText },
];

export function AdminShell({ children, user }: AdminShellProps) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-bg-elevated/40">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-hard/15 border border-hard/40 text-hard">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">
              intervue<span className="text-accent">.</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-hard/80">
              admin
            </div>
          </div>
        </div>
        <nav className="p-2 flex-1 space-y-0.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active =
              n.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-bg-surface text-text"
                    : "text-text-muted hover:text-text hover:bg-bg-surface/60"
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
            <div className="font-medium text-text-muted truncate">
              {user.name || "Admin"}
            </div>
            <div className="truncate">{user.email}</div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text"
          >
            <ArrowUpLeft className="h-3.5 w-3.5" /> Back to app
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden h-12 flex items-center gap-2 px-4 border-b border-border bg-bg/85 backdrop-blur sticky top-0 z-10">
          <ShieldCheck className="h-4 w-4 text-hard" />
          <span className="text-sm font-semibold">
            intervue<span className="text-accent">.</span>{" "}
            <span className="text-hard/80 text-xs">admin</span>
          </span>
          <Link
            href="/dashboard"
            className="ml-auto text-xs text-text-muted hover:text-text inline-flex items-center gap-1"
          >
            <ArrowUpLeft className="h-3.5 w-3.5" /> App
          </Link>
        </header>

        <nav className="lg:hidden border-b border-border bg-bg-elevated/30 px-3 py-2 overflow-x-auto flex gap-1 text-sm">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active =
              n.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md whitespace-nowrap ${
                  active
                    ? "bg-bg-surface text-text"
                    : "text-text-muted hover:text-text"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 min-w-0 p-6 lg:p-8 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
