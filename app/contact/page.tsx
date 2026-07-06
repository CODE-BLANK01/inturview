import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { ContactForm } from "@/components/ContactForm";

export const metadata = {
  title: "Contact — inturview",
  description:
    "Get in touch with the inturview team — questions, feedback, partnerships, or support.",
};

const CONTACT_EMAIL = "hello@inturview.com";

export default function ContactPage() {
  return (
    <>
      <TopNav />
      <main>
        <ContactHero />
        <ContactFormSection />
        <ContactFooter />
      </main>
    </>
  );
}

function ContactHero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">Contact</p>

        <h1 className="t-display text-text text-[40px] sm:text-[56px] md:text-[64px] max-w-3xl">
          Questions, feedback,
          <br />
          or just say <span className="t-italic">hello</span>.
        </h1>

        <p className="t-body mt-8 max-w-[520px] text-text-muted">
          We read every message. Whether you hit a bug, have a product idea, want to
          partner, or need help getting started — write to us and we&apos;ll get back
          to you.
        </p>

        <p className="t-body mt-6">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-text hover:text-text-ember transition-colors duration-150"
            style={{ fontWeight: 500 }}
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </section>
  );
}

function ContactFormSection() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-16 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,480px)] gap-12 lg:gap-16 items-start">
          <div>
            <p className="t-eyebrow mb-6">Send a message</p>
            <h2 className="t-section-headline text-[28px] sm:text-[32px] max-w-md text-text">
              Tell us what you&apos;re
              <br />
              working <span className="t-italic">through</span>.
            </h2>
            <p className="t-body-light text-[15px] mt-6 max-w-sm text-text-muted">
              Include as much detail as you can — error messages, session links, or
              what you were trying to practice. It helps us respond faster.
            </p>

            <ul className="mt-10 space-y-4">
              <ContactNote label="Response time" value="Within a few business days" />
              <ContactNote label="Support" value="Account, billing, and product help" />
              <ContactNote label="Feedback" value="Feature requests and honest critiques welcome" />
            </ul>
          </div>

          <ContactForm />
        </div>
      </div>
    </section>
  );
}

function ContactNote({ label, value }: { label: string; value: string }) {
  return (
    <li className="border-l-2 border-border pl-4">
      <p className="t-eyebrow text-text-dim">{label}</p>
      <p className="t-body-light text-[15px] mt-1 text-text-muted">{value}</p>
    </li>
  );
}

function ContactFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-10 text-center">
        <nav className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link
            href="/"
            className="t-eyebrow text-text-dim hover:text-text transition-colors duration-150"
          >
            Home
          </Link>
          <Link
            href="/about"
            className="t-eyebrow text-text-dim hover:text-text transition-colors duration-150"
          >
            About
          </Link>
          <Link
            href="/contact"
            className="t-eyebrow text-text transition-colors duration-150"
            aria-current="page"
          >
            Contact
          </Link>
        </nav>
        <p className="t-eyebrow">
          Inturview · NeetCode 150 · Made for candidates who are serious
        </p>
      </div>
    </footer>
  );
}
