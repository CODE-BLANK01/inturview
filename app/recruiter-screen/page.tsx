import { redirect } from "next/navigation";
import { ConversationSession } from "@/components/ConversationSession";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recruiter screen — inturview" };

export default async function RecruiterScreenPage() {
  const user = await requireUser();
  if (!user) redirect("/signin?callbackUrl=/recruiter-screen");

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailVerifiedAt: true, onboardingCompletedAt: true },
  });
  if (!profile?.emailVerifiedAt) redirect("/verify-email");
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  return (
    <ConversationSession
      kind="RECRUITER_SCREEN"
      title="Recruiter screen"
      subtitle="25-min initial phone screen"
      prompt="A recruiter is calling you for an initial screen. They'll walk through your resume, ask why you're looking now, probe compensation expectations, and run logistics. Treat it like the real call — clear, professional, two-way."
      backHref="/dashboard"
      backLabel="Dashboard"
    />
  );
}
