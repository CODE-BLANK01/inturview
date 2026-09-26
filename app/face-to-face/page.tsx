import { redirect } from "next/navigation";
import { FaceToFaceSession } from "@/components/FaceToFaceSession";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FACE_TO_FACE_ENABLED } from "@/lib/features";
import type { FaceToFacePlan } from "@/lib/faceToFaceQuestions";
import { getEffectivePlan, startOfMonthUTC } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Face-to-face interview — inturview" };

export default async function FaceToFacePage() {
  if (!FACE_TO_FACE_ENABLED) redirect("/dashboard");

  const user = await requireUser();
  if (!user) redirect("/signin?callbackUrl=/face-to-face");

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, emailVerifiedAt: true, onboardingCompletedAt: true },
  });
  if (!profile?.emailVerifiedAt) redirect("/verify-email");
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  const plan = getEffectivePlan(profile.plan, user.email);
  const cap = plan.faceToFaceSessionsPerMonth;
  const monthStart = startOfMonthUTC();
  const [used, inProgress] = await Promise.all([
    prisma.conversationSession.count({
      where: { userId: user.id, kind: "FACE_TO_FACE", startedAt: { gte: monthStart } },
    }),
    prisma.conversationSession.findFirst({
      where: { userId: user.id, kind: "FACE_TO_FACE", status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, plan: true },
    }),
  ]);
  // Mirrors /api/face-to-face/start: an unexpired in-progress session can be
  // resumed even at the cap, so it must not be blocked here.
  const resumePlan = inProgress?.plan as unknown as FaceToFacePlan | null | undefined;
  const canResume =
    !!inProgress &&
    !!resumePlan &&
    inProgress.startedAt.getTime() + resumePlan.maxDurationSec * 1000 >= Date.now();
  const nextMonthStart = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
  );

  return (
    <FaceToFaceSession
      backHref="/dashboard"
      backLabel="Dashboard"
      usage={{
        used,
        cap,
        planName: plan.name,
        limitReached: cap !== null && used >= cap && !canResume,
        resetsOn: nextMonthStart.toISOString(),
      }}
    />
  );
}
