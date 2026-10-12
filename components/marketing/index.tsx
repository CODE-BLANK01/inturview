import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageView } from "@/components/analytics/TrackOnMount";
export { Reveal } from "./Reveal";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-site">
      <PageView />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <TopNav marketing />
      <main id="main-content" className="marketing">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function Section({
  children,
  tone = "page",
  size = "lg",
  className = "",
  id,
}: {
  children: ReactNode;
  tone?: "page" | "inset" | "inverse";
  size?: "sm" | "md" | "lg";
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`m-section m-tone-${tone} m-size-${size} ${className}`}
    >
      <div className="m-container">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="t-eyebrow m-eyebrow">{children}</p>;
}

export function SectionHeading({
  eyebrow,
  children,
  deck,
  as: Tag = "h2",
}: {
  eyebrow: string;
  children: ReactNode;
  deck?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="m-heading">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Tag className={Tag === "h1" ? "t-display-1" : "t-display-2"}>
        {children}
      </Tag>
      {deck && <p className="m-deck">{deck}</p>}
    </div>
  );
}

export function Cta({
  href = "/signup",
  children = "Start free",
  secondary = false,
}: {
  href?: string;
  children?: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`m-button ${secondary ? "m-button-secondary" : "m-button-primary"}`}
    >
      {children}
      <ArrowUpRight size={18} aria-hidden="true" />
    </Link>
  );
}

export function CtaBand({
  title = "Your next interview starts here.",
  deck = "Find your gaps before the real conversation.",
  employer = false,
}: {
  title?: string;
  deck?: string;
  employer?: boolean;
}) {
  return (
    <Section tone="inverse" size="md" className="m-cta-band">
      <div>
        <Eyebrow>{employer ? "Build with us" : "Practice with intent"}</Eyebrow>
        <h2 className="t-display-2">{title}</h2>
        <p className="m-deck">{deck}</p>
      </div>
      <div className="m-cta-end">
        <Cta href={employer ? "/contact?topic=employers" : "/signup"}>
          {employer ? "Become a design partner" : "Start free"}
        </Cta>
        <p className="m-caption">
          {employer
            ? "One role. A focused pilot. Your feedback."
            : "No credit card. No scheduling."}
        </p>
      </div>
    </Section>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="m-stat">
      <strong className="t-display-2">{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function FeatureRow({ children }: { children: ReactNode }) {
  return (
    <li className="m-feature">
      <Check size={16} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}
