import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BEHAVIORAL_SCENARIOS } from "@/lib/behavioralScenarios";
import { getPlan, startOfMonthUTC } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Behavioral — inturview" };

export default async function BehavioralIndexPage() {
  const user = await requireUser();
  if (!user) redirect("/signin?callbackUrl=/behavioral");

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, emailVerifiedAt: true, onboardingCompletedAt: true },
  });
  if (!profile?.emailVerifiedAt) redirect("/verify-email");
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  const plan = getPlan(profile.plan);
  const monthStart = startOfMonthUTC();
  const used = await prisma.conversationSession.count({
    where: {
      userId: user.id,
      kind: "BEHAVIORAL",
      startedAt: { gte: monthStart },
    },
  });
  const attempted = await prisma.conversationSession.findMany({
    where: { userId: user.id, kind: "BEHAVIORAL" },
    select: { scenarioId: true },
  });
  const attemptedIds = new Set(attempted.map((a) => a.scenarioId).filter(Boolean) as string[]);

  const cap = plan.behavioralSessionsPerMonth;
  const atLimit = cap !== null && used >= cap;

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="t-section-headline text-3xl">
              Behavioral<span className="text-text-ember">.</span>
            </h1>
            <p className="t-body-light mt-2 text-text-muted">
              STAR-method drills against the questions interviewers actually ask.
              ✓ marks scenarios you&apos;ve already practiced.
            </p>
          </div>
          <div className="text-sm text-text-muted">
            <span className="tabular-nums">{used}</span>
            {cap !== null && <> / {cap}</>}
            <span className="text-text-dim"> this month</span>
          </div>
        </header>

        {atLimit && (
          <div className="panel mb-6 border-hard/40 p-4 text-sm">
            You&apos;ve used all {cap} behavioral sessions on the {plan.name} plan
            this month. Resets on the 1st.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BEHAVIORAL_SCENARIOS.map((s) => {
            const attemptedThis = attemptedIds.has(s.id);
            const body = (
              <>
                <div className="flex items-center gap-2 text-xs text-text-dim mb-2">
                  <span className="rounded-full bg-bg-inset px-2 py-0.5">{s.category}</span>
                  {attemptedThis && <span className="ml-auto text-accent">✓</span>}
                </div>
                <h2 className="text-base font-semibold mb-1.5">{s.title}</h2>
                <p className="text-sm text-text-muted line-clamp-3">{s.prompt}</p>
              </>
            );
            if (atLimit) {
              return (
                <div
                  key={s.id}
                  className="panel block p-4 opacity-50 cursor-not-allowed"
                  aria-disabled
                >
                  {body}
                </div>
              );
            }
            return (
              <Link
                key={s.id}
                href={`/behavioral/${s.id}`}
                className="panel block p-4 hover:border-accent transition-colors"
              >
                {body}
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
