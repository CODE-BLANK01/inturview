import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { AccountPage } from "@/components/account/AccountPage";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectivePlan, startOfMonthUTC } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account — inturview" };

export default async function AccountSettingsPage() {
  const user = await requireUser();
  if (!user) redirect("/signin?callbackUrl=/account");

  const monthStart = startOfMonthUTC();
  const [
    profile,
    interviewsThisMonth,
    designSessionsThisMonth,
    behavioralSessionsThisMonth,
    recruiterSessionsThisMonth,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
        name: true,
        role: true,
        plan: true,
        goal: true,
        emailVerifiedAt: true,
        onboardingCompletedAt: true,
        totpEnabledAt: true,
        createdAt: true,
      },
    }),
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

  if (!profile) redirect("/signin");
  if (!profile.emailVerifiedAt) redirect("/verify-email");

  const plan = getEffectivePlan(profile.plan, profile.email);

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <header className="mb-10">
          <p className="t-eyebrow mb-2">Account</p>
          <h1 className="t-section-headline text-3xl sm:text-4xl">
            Your settings.
          </h1>
          <p className="t-body-light text-text-muted mt-2 text-[15px]">
            Manage your profile, your plan, your password, and — if it comes to
            that — delete the account entirely.
          </p>
        </header>

        <AccountPage
          profile={{
            email: profile.email,
            name: profile.name,
            role: profile.role,
            plan: profile.plan,
            goal: profile.goal,
            twoFactorEnabled: !!profile.totpEnabledAt,
            createdAt: profile.createdAt.toISOString(),
          }}
          planInfo={plan}
          usage={{
            interviewsThisMonth,
            designSessionsThisMonth,
            behavioralSessionsThisMonth,
            recruiterSessionsThisMonth,
          }}
        />
      </main>
    </>
  );
}
