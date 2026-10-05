import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PracticeActivity } from "@/components/dashboard/PracticeActivity";
import { Greeting } from "@/components/dashboard/Greeting";
import { ResumeRow } from "@/components/dashboard/ResumeRow";
import { PracticeModes } from "@/components/dashboard/PracticeModes";
import { TopicMastery } from "@/components/dashboard/TopicMastery";
import { RecentInterviews } from "@/components/dashboard/RecentInterviews";
import { PlanUsage } from "@/components/dashboard/PlanUsage";
import { FaceToFacePreview } from "@/components/dashboard/FaceToFacePreview";
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
    select: {
      plan: true,
      planExpiresAt: true,
      emailVerifiedAt: true,
      onboardingCompletedAt: true,
      createdAt: true,
      returnedWithin7dAt: true,
    },
  });
  if (!profile) redirect("/signin");
  if (!profile.emailVerifiedAt) redirect("/verify-email");
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  // First authenticated dashboard visit on a later day, within the first week.
  // An atomic stamp prevents duplicate retention events on concurrent page loads.
  const now = new Date();
  const daysSinceSignup =
    (now.getTime() - profile.createdAt.getTime()) / 86_400_000;
  if (
    process.env.POSTHOG_PROJECT_TOKEN &&
    !profile.returnedWithin7dAt &&
    daysSinceSignup >= 1 &&
    daysSinceSignup <= 7
  ) {
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

  const plan = getEffectivePlan(
    profile.plan,
    user.email,
    profile.planExpiresAt,
  );
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
      where: {
        userId: user.id,
        kind: "BEHAVIORAL",
        startedAt: { gte: monthStart },
      },
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
    <DashboardShell
      name={user.name}
      email={user.email}
      planName={plan.name}
      paid={plan.tier === "PRO"}
      isAdmin={user.role === "ADMIN"}
    >
      <Greeting name={user.name ?? user.email} stats={data.stats}>
        <ResumeRow inProgress={data.inProgress} suggestion={data.suggestion} />
      </Greeting>
      <PracticeModes />
      <div className="dashboard-detail-grid">
        <RecentInterviews items={data.recent} />
        <div className="dashboard-progress-column">
          <PracticeActivity activity={data.activity} stats={data.stats} />
          <FaceToFacePreview />
        </div>
      </div>
      <details className="dashboard-coverage">
        <summary>
          <span>Coding topic coverage</span>
          <span>Explore your range <span aria-hidden="true">+</span></span>
        </summary>
        <TopicMastery topics={data.topicMastery} />
      </details>
      <PlanUsage
        plan={plan}
        interviewsThisMonth={interviewsThisMonth}
        designSessionsThisMonth={designSessionsThisMonth}
        behavioralSessionsThisMonth={behavioralSessionsThisMonth}
        recruiterSessionsThisMonth={recruiterSessionsThisMonth}
      />
    </DashboardShell>
  );
}
