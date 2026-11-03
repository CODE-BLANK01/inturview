import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LOOP_PREVIEW_ENABLED } from "@/lib/features";
import { getEffectivePlan, startOfMonthUTC } from "@/lib/plans";
import { PracticeWorkspace } from "@/components/dashboard/PracticeWorkspace";
import { LoopProvider } from "@/components/loop/LoopProvider";
import "./loop.css";

export const dynamic = "force-dynamic";
export default async function LoopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!LOOP_PREVIEW_ENABLED) notFound();
  const user = await requireUser();
  if (!user) redirect("/signin?callbackUrl=/loop/new");
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      plan: true,
      planExpiresAt: true,
      emailVerifiedAt: true,
      onboardingCompletedAt: true,
    },
  });
  if (!profile?.emailVerifiedAt) redirect("/verify-email");
  if (!profile.onboardingCompletedAt) redirect("/onboarding");
  const plan = getEffectivePlan(
    profile.plan,
    user.email,
    profile.planExpiresAt,
  );
  const where = { userId: user.id, startedAt: { gte: startOfMonthUTC() } };
  const [coding, design, behavioral, recruiter] = await Promise.all([
    prisma.interview.count({ where }),
    prisma.designSession.count({ where }),
    prisma.conversationSession.count({
      where: { ...where, kind: "BEHAVIORAL" },
    }),
    prisma.conversationSession.count({
      where: { ...where, kind: "RECRUITER_SCREEN" },
    }),
  ]);
  const quotas = {
    coding: { used: coding, cap: plan.interviewsPerMonth },
    design: { used: design, cap: plan.designSessionsPerMonth },
    behavioral: { used: behavioral, cap: plan.behavioralSessionsPerMonth },
    recruiter: { used: recruiter, cap: plan.recruiterSessionsPerMonth },
  };
  return (
    <PracticeWorkspace user={user} plan={plan}>
      <LoopProvider ownerId={user.id} quotas={quotas}>
        {children}
      </LoopProvider>
    </PracticeWorkspace>
  );
}
