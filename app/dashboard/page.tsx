import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Greeting } from "@/components/dashboard/Greeting";
import { StatGrid } from "@/components/dashboard/StatGrid";
import { ResumeRow } from "@/components/dashboard/ResumeRow";
import { PracticeModes } from "@/components/dashboard/PracticeModes";
import { TopicMastery } from "@/components/dashboard/TopicMastery";
import { RecentInterviews } from "@/components/dashboard/RecentInterviews";
import { RoadmapPanel } from "@/components/dashboard/RoadmapPanel";
import { PlanUsage } from "@/components/dashboard/PlanUsage";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadDashboardData } from "@/lib/dashboard";
import { getEffectivePlan, startOfMonthUTC } from "@/lib/plans";
import { captureProductEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — inturview" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/signin?callbackUrl=/dashboard");

  // Gate chain: verify-email → onboarding → dashboard. Each step blocks the next.
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, planExpiresAt: true, emailVerifiedAt: true, onboardingCompletedAt: true, createdAt: true, returnedWithin7dAt: true },
  });
  if (!profile) redirect("/signin");
  if (!profile.emailVerifiedAt) redirect("/verify-email");
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  // First authenticated dashboard visit on a later day, within the first week.
  // An atomic stamp prevents duplicate retention events on concurrent page loads.
  const now = new Date();
  const daysSinceSignup = (now.getTime() - profile.createdAt.getTime()) / 86_400_000;
  if (process.env.POSTHOG_PROJECT_TOKEN && !profile.returnedWithin7dAt && daysSinceSignup >= 1 && daysSinceSignup <= 7) {
    const stamped = await prisma.user.updateMany({
      where: { id: user.id, returnedWithin7dAt: null },
      data: { returnedWithin7dAt: now },
    });
    if (stamped.count === 1) {
      const sent = await captureProductEvent(user.id, {
        event: "returned_within_7d",
        properties: { days_since_signup: Math.floor(daysSinceSignup) },
      });
      if (!sent) {
        await prisma.user.updateMany({
          where: { id: user.id, returnedWithin7dAt: now },
          data: { returnedWithin7dAt: null },
        });
      }
    }
  }

  const plan = getEffectivePlan(profile.plan, user.email, profile.planExpiresAt);
  const monthStart = startOfMonthUTC();
  const [
    interviewsThisMonth,
    designSessionsThisMonth,
    behavioralSessionsThisMonth,
    recruiterSessionsThisMonth,
  ] = await Promise.all([
    prisma.interview.count({
      where: { userId: user.id, startedAt: { gte: monthStart } },
    }),
    prisma.designSession.count({
      where: { userId: user.id, startedAt: { gte: monthStart } },
    }),
    prisma.conversationSession.count({
      where: { userId: user.id, kind: "BEHAVIORAL", startedAt: { gte: monthStart } },
    }),
    prisma.conversationSession.count({
      where: {
        userId: user.id,
        kind: "RECRUITER_SCREEN",
        startedAt: { gte: monthStart },
      },
    }),
  ]);

  const data = await loadDashboardData(user.id);

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <Greeting name={user.name ?? user.email} stats={data.stats} />

        <div className="space-y-6">
          <StatGrid stats={data.stats} />
          <PlanUsage
            plan={plan}
            interviewsThisMonth={interviewsThisMonth}
            designSessionsThisMonth={designSessionsThisMonth}
            behavioralSessionsThisMonth={behavioralSessionsThisMonth}
            recruiterSessionsThisMonth={recruiterSessionsThisMonth}
          />
          <ResumeRow
            inProgress={data.inProgress}
            lastCompleted={data.recent[0]}
            suggestion={data.suggestion}
          />
          <PracticeModes />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-6 min-w-0">
              <TopicMastery topics={data.topicMastery} />
              <RecentInterviews items={data.recent} />
            </div>
            <RoadmapPanel />
          </div>
        </div>
      </main>
    </>
  );
}
