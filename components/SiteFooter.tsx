import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "./Brand";

export function SiteFooter() {
  return (
    <footer className="landing-footer">
      <div>
        <Link href="/" aria-label="Inturview home">
          <Brand wordmarkOnly />
        </Link>
        <p>A little more prepared, every time.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/about">Our story</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/employers">
          For employers <ArrowUpRight size={12} />
        </Link>
        <Link href="/contact">
          Say hello <ArrowUpRight size={12} />
        </Link>
      </nav>
      <span>© {new Date().getFullYear()} Inturview</span>
    </footer>
  );
}
