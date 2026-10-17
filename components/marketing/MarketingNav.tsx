"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";

const links = [
  ["/pricing", "Pricing"],
  ["/employers", "For employers"],
  ["/about", "About"],
  ["/contact", "Contact"],
] as const;
export function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return (
    <header ref={header} className="m-nav">
      <div className="m-nav-inner">
        <Link href="/" aria-label="Inturview home">
          <Brand wordmarkOnly />
        </Link>
        <nav className="m-nav-links" aria-label="Main navigation">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="m-nav-actions">
          <ThemeToggle />
          <Link href="/signin" className="m-signin">
            Sign in
          </Link>
          <Link href="/signup" className="m-nav-cta">
            Start free <span aria-hidden="true">↗</span>
          </Link>
          <button
            ref={button}
            className="m-menu-button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="public-mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      <nav
        id="public-mobile-nav"
        className="m-mobile-nav"
        aria-label="Mobile navigation"
        hidden={!open}
      >
        {links.map(([href, label]) => (
          <Link
            href={href}
            key={href}
            aria-current={pathname === href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {label}
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
        <Link href="/signin">Sign in</Link>
      </nav>
    </header>
  );
}
