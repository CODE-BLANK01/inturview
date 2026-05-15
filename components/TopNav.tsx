"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";

export function TopNav() {
  const { data, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isAuthed = status === "authenticated";
  const isAdmin =
    (data?.user as { role?: "USER" | "ADMIN" } | undefined)?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/85 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-4">
        <Link href={isAuthed ? "/dashboard" : "/"} className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold tracking-tight">
            intervue<span className="text-accent">.</span>
          </span>
        </Link>

        {isAuthed && (
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <NavLink href="/dashboard" active={pathname === "/dashboard"}>
              Dashboard
            </NavLink>
            <NavLink href="/problems" active={pathname?.startsWith("/problems") ?? false}>
              Practice
            </NavLink>
            <NavLink href="/history" active={pathname?.startsWith("/history") ?? false}>
              History
            </NavLink>
            {isAdmin && (
              <Link
                href="/admin"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  pathname?.startsWith("/admin")
                    ? "text-hard bg-hard/10"
                    : "text-hard/80 hover:text-hard hover:bg-hard/5"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}
          </nav>
        )}

        <nav className="flex items-center gap-2">
          {isAuthed ? (
            <div className="relative">
              <button
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-text-muted hover:text-text hover:bg-bg-surface transition-colors"
                onClick={() => setOpen((v) => !v)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
              >
                <Avatar email={data?.user?.email ?? ""} name={data?.user?.name ?? null} />
                <span className="hidden sm:inline max-w-[160px] truncate">
                  {data?.user?.name || data?.user?.email || "Account"}
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {open && (
                <div className="absolute right-0 top-full mt-1 w-56 panel py-1 shadow-lg">
                  <div className="px-3 py-2 border-b border-border">
                    <div className="text-sm font-medium truncate">
                      {data?.user?.name || "Account"}
                    </div>
                    <div className="text-xs text-text-dim truncate">{data?.user?.email}</div>
                  </div>
                  <div className="md:hidden">
                    <DropdownLink href="/dashboard">Dashboard</DropdownLink>
                    <DropdownLink href="/problems">Practice</DropdownLink>
                    <DropdownLink href="/history">History</DropdownLink>
                    <div className="my-1 border-t border-border" />
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-bg-surface inline-flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : status === "unauthenticated" ? (
            <Fragment>
              <Link href="/signin" className="btn text-sm">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-primary text-sm">
                Get started
              </Link>
            </Fragment>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md transition-colors ${
        active
          ? "text-text bg-bg-surface"
          : "text-text-muted hover:text-text hover:bg-bg-surface/60"
      }`}
    >
      {children}
    </Link>
  );
}

function DropdownLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-sm hover:bg-bg-surface"
    >
      {children}
    </Link>
  );
}

function Avatar({ email, name }: { email: string; name: string | null }) {
  const initial = (name?.trim()?.[0] ?? email?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-medium">
      {initial}
    </span>
  );
}

function Logo() {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 border border-accent/30 text-accent">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 17l5-5-5-5" />
        <path d="M12 19h8" />
      </svg>
    </span>
  );
}
