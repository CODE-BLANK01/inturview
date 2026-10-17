"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  ChevronRight,
  Code2,
  Crown,
  History,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Network,
  Settings2,
  ShieldCheck,
  Users,
  Video,
  X,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FACE_TO_FACE_ENABLED } from "@/lib/features";
import { signOutTo } from "@/lib/signOutTo";

const rounds = [
  { href: "/recruiter-screen", label: "Recruiter screen", icon: MessageSquare },
  { href: "/behavioral", label: "Behavioral", icon: Users },
  { href: "/problems", label: "Coding", icon: Code2 },
  { href: "/design-problems", label: "System design", icon: Network },
];

export function DashboardShell({
  children,
  name,
  email,
  planName,
  paid,
  isAdmin,
}: {
  children: React.ReactNode;
  name: string | null;
  email: string;
  planName: string;
  paid: boolean;
  isAdmin: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const displayName = name || email.split("@")[0];
  const pathname = usePathname();
  const active = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  const pageTitle = pathname.startsWith("/history/")
    ? "Interview debrief"
    : active("/history")
      ? "Interview history"
      : active("/account")
        ? "Account & plan"
        : (rounds.find((round) => active(round.href))?.label ?? "Overview");

  useEffect(() => {
    const el = dialog.current;
    const unlock = () => {
      document.body.style.overflow = "";
      menuButton.current?.focus();
    };
    el?.addEventListener("close", unlock);
    return () => {
      el?.removeEventListener("close", unlock);
      document.body.style.overflow = "";
    };
  }, []);

  const closeMenu = () => dialog.current?.close();
  const sidebar = (
    <>
      <Link href="/dashboard" className="workspace-brand" onClick={closeMenu}>
        <Brand wordmarkOnly />
      </Link>
      <div className="workspace-label">Your interview workspace</div>
      <nav
        aria-label="Workspace navigation"
        className="workspace-nav"
        onClick={closeMenu}
      >
        <Link
          href="/dashboard"
          className={`workspace-nav-link ${active("/dashboard") ? "is-active" : ""}`}
          aria-current={active("/dashboard") ? "page" : undefined}
        >
          <LayoutGrid size={17} /> Home
          {active("/dashboard") && <span className="nav-active-dot" />}
        </Link>
        <Link
          href="/history"
          className={`workspace-nav-link ${active("/history") ? "is-active" : ""}`}
          aria-current={active("/history") ? "page" : undefined}
        >
          <History size={17} /> History
          {active("/history") && <span className="nav-active-dot" />}
        </Link>
        <p className="workspace-nav-heading">Practice</p>
        {rounds.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`workspace-nav-link ${active(href) ? "is-active" : ""}`}
            aria-current={active(href) ? "page" : undefined}
          >
            <Icon size={17} />
            {label}
            {active(href) && <span className="nav-active-dot" />}
          </Link>
        ))}
        {FACE_TO_FACE_ENABLED ? (
          <Link href="/face-to-face" className="workspace-nav-link">
            <Video size={17} /> Face-to-face
          </Link>
        ) : (
          <a
            href="mailto:hello@inturview.com?subject=Face-to-face%20early%20access"
            className="workspace-nav-link"
          >
            <Video size={17} /> Face-to-face{" "}
            <span className="nav-soon">Soon</span>
          </a>
        )}
        <p className="workspace-nav-heading">Workspace</p>
        <Link
          href="/account"
          className={`workspace-nav-link ${active("/account") ? "is-active" : ""}`}
          aria-current={active("/account") ? "page" : undefined}
        >
          <Settings2 size={17} /> Account & plan
          {active("/account") && <span className="nav-active-dot" />}
        </Link>
        {isAdmin && (
          <Link href="/admin" className="workspace-nav-link">
            <ShieldCheck size={17} /> Admin
          </Link>
        )}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-plan">
          <div className="sidebar-plan-title"><Crown size={15} /> {paid ? planName : "Room to practice more"}</div>
          <p>{paid ? "Unlimited practice. At your pace." : "30 days of unlimited practice."}</p>
          <Link href="/account" onClick={closeMenu}>
            {paid ? "Manage plan" : "Explore Interview Sprint"}
            <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="sidebar-profile">
          <Link href="/account" className="sidebar-person" onClick={closeMenu}>
            <span className="profile-avatar">
              {displayName?.[0]?.toUpperCase() || "U"}
            </span>
            <span className="min-w-0">
              <strong>{displayName}</strong>
              <small>{planName}</small>
            </span>
          </Link>
          <button
            type="button"
            className="studio-icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void signOutTo("/")}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="workspace">
      <a href="#workspace-main" className="skip-link">
        Skip to content
      </a>
      <aside className="workspace-sidebar">{sidebar}</aside>
      <dialog
        ref={dialog}
        className="workspace-drawer"
        aria-label="Navigation"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeMenu();
        }}
      >
        <div className="workspace-drawer-content">
          <button
            type="button"
            className="studio-icon-button drawer-close"
            onClick={closeMenu}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
          {sidebar}
        </div>
      </dialog>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <div className="flex items-center gap-3">
            <button
              type="button"
              ref={menuButton}
              className="studio-icon-button workspace-menu"
              aria-label="Open navigation"
              aria-haspopup="dialog"
              onClick={() => {
                dialog.current?.showModal();
                document.body.style.overflow = "hidden";
              }}
            >
              <Menu size={21} />
            </button>
            <Link
              href="/dashboard"
              className="workspace-mobile-brand"
              aria-label="inturview home"
            >
              <Brand compact symbolOnly />
            </Link>
            <span className="workspace-breadcrumb">
              Your workspace <ChevronRight size={13} />
              <strong>{pageTitle}</strong>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/contact" className="workspace-help">
              Need a hand? <ArrowUpRight size={13} />
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main id="workspace-main" tabIndex={-1} className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>A little more prepared, every time.</span>
          <span>
            Made for your next chapter <span aria-hidden="true">↗</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
