import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  consumeVerificationToken,
  validateVerificationToken,
} from "@/lib/emailVerification";
import { VerifyEmailStandby } from "@/components/VerifyEmailStandby";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your email — inturview" };

interface VerifyEmailPageProps {
  searchParams: { token?: string };
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const user = await requireUser();
  if (!user) redirect("/signin?callbackUrl=/verify-email");

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, emailVerifiedAt: true, onboardingCompletedAt: true },
  });
  if (!profile) redirect("/signin");

  const next = profile.onboardingCompletedAt ? "/dashboard" : "/onboarding";

  // If they're already verified and visit this page (with or without token),
  // bounce them forward.
  if (profile.emailVerifiedAt) redirect(next);

  // Token consume path — server-side, idempotent.
  if (searchParams.token) {
    const result = await validateVerificationToken(searchParams.token);
    if (result.ok) {
      // Belt-and-suspenders: the token's owning user must match the signed-in user.
      // This prevents one signed-in user from "verifying" via a link they intercepted
      // for a different account.
      if (result.userId !== user.id) {
        return (
          <main className="min-h-screen flex items-center justify-center px-4 py-12">
            <VerifyEmailStandby
              email={profile.email}
              topMessage={{
                tone: "error",
                text: "That verification link belongs to a different account. Sign out and try the link again, or request a fresh one below.",
              }}
            />
          </main>
        );
      }
      await consumeVerificationToken({
        tokenId: result.tokenId,
        userId: user.id,
      });
      redirect(next);
    }

    // Invalid token — surface a clean message and let them request a new one.
    const reasonText =
      result.reason === "expired"
        ? "This verification link has expired. We can send a new one — click below."
        : result.reason === "consumed"
        ? "This link has already been used. If you're not verified yet, request a new one."
        : "This verification link is invalid. Request a new one below.";

    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12">
        <VerifyEmailStandby
          email={profile.email}
          topMessage={{ tone: "error", text: reasonText }}
        />
      </main>
    );
  }

  // No token in URL — standby state, prompt to check inbox / resend.
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <VerifyEmailStandby email={profile.email} />
    </main>
  );
}
