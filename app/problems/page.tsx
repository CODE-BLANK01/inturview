import { TopNav } from "@/components/TopNav";
import { ProblemBrowser } from "@/components/ProblemBrowser";

export const metadata = { title: "Problems — intervue" };

export default function ProblemsPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Pick a problem<span className="text-accent">.</span>
          </h1>
          <p className="mt-1 text-text-muted">
            Filter by topic and difficulty. ✓ marks problems you&apos;ve already attempted.
          </p>
        </header>
        <ProblemBrowser />
      </main>
    </>
  );
}
