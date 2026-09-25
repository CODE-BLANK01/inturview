import Link from "next/link";
import { Check } from "lucide-react";
import { TopNav } from "@/components/TopNav";

export const metadata = {
  title: "Inturview Hire — AI candidate screening",
  description:
    "Create structured AI screening interviews, compare evidence-backed scorecards, and shortlist candidates for human interviews.",
};

const FLOW = [
  ["01", "Create", "Define the role, questions, and evidence that should move a candidate forward."],
  ["02", "Invite", "Send each candidate the same structured AI screening interview."],
  ["03", "Shortlist", "Compare scorecards, inspect evidence, and choose who reaches a human interview."],
] as const;

export default function EmployersPage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="surface-inverse border-b border-border">
          <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
            <p className="t-eyebrow text-text-ember mb-6">Inturview Hire · design partners</p>
            <h1 className="t-display text-text-inverse text-[40px] sm:text-[56px] md:text-[64px] max-w-4xl">
              Let every candidate interview.
              <br />
              Shortlist the evidence.
            </h1>
            <p className="t-body-light text-[17px] text-text-muted mt-8 max-w-2xl">
              Run structured AI screening interviews before the human round. Every
              candidate gets the same opportunity to answer; your hiring team gets
              comparable scorecards, supporting evidence, and a focused shortlist.
            </p>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-24">
            <p className="t-eyebrow mb-8">How employer screening works</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {FLOW.map(([number, title, body]) => (
                <article key={number} className="panel p-6">
                  <p className="t-data text-text-ember">{number}</p>
                  <h2 className="text-lg font-semibold mt-5">{title}</h2>
                  <p className="text-sm text-text-muted leading-relaxed mt-2">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-24 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 items-start">
            <div>
              <p className="t-eyebrow mb-6">The pilot</p>
              <h2 className="t-section-headline text-[32px] sm:text-[40px] max-w-2xl">
                Build the screening workflow around one real role.
              </h2>
              <ul className="mt-8 space-y-3 text-sm text-text-muted">
                {[
                  "Founder-led interview and rubric setup",
                  "The first 10 completed employer-invited screens",
                  "Evidence-backed scorecards and ranked shortlist",
                  "A calibration review with the hiring team",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-text-ember shrink-0" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel p-6">
              <p className="t-eyebrow text-text-ember">Design partner pricing</p>
              <p className="t-display text-[36px] mt-3">First 10 free</p>
              <p className="text-sm text-text-muted mt-2">completed candidate screens</p>
              <div className="my-5 border-t border-border" />
              <p className="text-sm text-text-muted leading-relaxed">
                Then $10 per completed screen while we validate the workflow. No
                recruiter-seat fee. Volume pricing begins after 100 completed screens
                per month.
              </p>
              <a
                href="mailto:hello@inturview.com?subject=Inturview%20Hire%20design%20partner"
                className="btn btn-primary w-full mt-6"
              >
                Become a design partner
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 sm:px-12 py-10 text-center">
          <p className="text-sm text-text-muted">
            Preparing for your own interviews?{" "}
            <Link href="/pricing" className="text-text hover:underline underline-offset-4">
              See candidate practice pricing
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
