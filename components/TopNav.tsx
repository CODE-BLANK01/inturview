"use client";

import { Fragment, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function TopNav() {
  const { data, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isAuthed = status === "authenticated";
  const isAdmin =
    (data?.user as { role?: "USER" | "ADMIN" } | undefined)?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-4">
        <Link
          href={isAuthed ? "/dashboard" : "/"}
          aria-label="inturview home"
          className="flex items-center"
        >
          {/* The SVG is the wordmark — no separate text needed. */}
          <Image
            src="/logo.svg"
            alt="inturview"
            width={1000}
            height={500}
            priority
            className="h-8 w-auto rounded-[4px]"
          />
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
              <NavLink href="/admin" active={pathname?.startsWith("/admin") ?? false}>
                Admin
              </NavLink>
            )}
          </nav>
        )}

        <nav className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthed ? (
            <div className="relative">
              <button
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-text-muted hover:text-text hover:bg-bg-inset transition-colors duration-150"
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
                    {isAdmin && <DropdownLink href="/admin">Admin</DropdownLink>}
                    <div className="my-1 border-t border-border" />
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-bg-inset inline-flex items-center gap-2"
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
      className={`px-3 py-1.5 rounded-md transition-colors duration-150 ${
        active
          ? "text-text bg-bg-inset"
          : "text-text-muted hover:text-text hover:bg-bg-inset/60"
      }`}
    >
      {children}
    </Link>
  );
}

function DropdownLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block px-3 py-2 text-sm hover:bg-bg-inset">
      {children}
    </Link>
  );
}

function Avatar({ email, name }: { email: string; name: string | null }) {
  const initial = (name?.trim()?.[0] ?? email?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs t-data"
      style={{
        background: "rgb(var(--bg-inverse))",
        color: "rgb(var(--text-inverse))",
        borderColor: "rgb(var(--bg-inverse))",
      }}
    >
      {initial}
    </span>
  );
}

