import { redirect } from "next/navigation";
import { FaceToFaceSession } from "@/components/FaceToFaceSession";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FACE_TO_FACE_ENABLED } from "@/lib/features";

export const dynamic = "force-dynamic";
export const metadata = { title: "Face-to-face interview — inturview" };

export default async function FaceToFacePage() {
  if (!FACE_TO_FACE_ENABLED) redirect("/dashboard");

  const user = await requireUser();
  if (!user) redirect("/signin?callbackUrl=/face-to-face");

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailVerifiedAt: true, onboardingCompletedAt: true },
  });
  if (!profile?.emailVerifiedAt) redirect("/verify-email");
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  return <FaceToFaceSession backHref="/dashboard" backLabel="Dashboard" />;
}
