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
import { getPlan, startOfMonthUTC } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — inturview" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/signin?callbackUrl=/dashboard");

  // Gate chain: verify-email → onboarding → dashboard. Each step blocks the next.
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, emailVerifiedAt: true, onboardingCompletedAt: true },
  });
  if (!profile) redirect("/signin");
  if (!profile.emailVerifiedAt) redirect("/verify-email");
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  const plan = getPlan(profile.plan);
  const monthStart = startOfMonthUTC();
  const [interviewsThisMonth, designSessionsThisMonth] = await Promise.all([
    prisma.interview.count({
      where: { userId: user.id, startedAt: { gte: monthStart } },
    }),
    prisma.designSession.count({
      where: { userId: user.id, startedAt: { gte: monthStart } },
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
