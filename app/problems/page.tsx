import { redirect } from "next/navigation";
import { PracticeWorkspace } from "@/components/dashboard/PracticeWorkspace";
import { ProblemBrowser } from "@/components/ProblemBrowser";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Problems — inturview" };

export default async function ProblemsPage() {
  const user = await requireUser();
  if (!user) redirect("/signin?callbackUrl=/problems");

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailVerifiedAt: true, onboardingCompletedAt: true },
  });
  if (!profile?.emailVerifiedAt) redirect("/verify-email");
  if (!profile.onboardingCompletedAt) redirect("/onboarding");

  return (
    <PracticeWorkspace user={user}>
      <div className="workspace-page w-full">
        <header className="mb-8">
          <h1 className="t-section-headline text-3xl">
            Pick a problem<span className="text-text-ember">.</span>
          </h1>
          <p className="t-body-light mt-2 text-text-muted">
            Filter by topic and difficulty. ✓ marks problems you&apos;ve already
            attempted.
          </p>
        </header>
        <ProblemBrowser />
      </div>
    </PracticeWorkspace>
  );
}
