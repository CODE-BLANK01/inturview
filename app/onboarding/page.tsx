import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome — inturview" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (!user) redirect("/signin?callbackUrl=/onboarding");

  // Gate: verify-email must come before the onboarding wizard.
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, emailVerifiedAt: true, onboardingCompletedAt: true },
  });
  if (!row?.emailVerifiedAt) redirect("/verify-email");
  if (row.onboardingCompletedAt) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-start justify-center px-4 py-12 sm:py-16">
      <OnboardingWizard initialName={row?.name ?? user.name} email={user.email} />
    </main>
  );
}
