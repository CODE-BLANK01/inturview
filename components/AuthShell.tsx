import Link from "next/link";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <header className="auth-header">
        <Link href="/" aria-label="Inturview home">
          <Brand />
        </Link>
        <ThemeToggle />
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        A little more prepared, every time.
      </footer>
    </div>
  );
}
