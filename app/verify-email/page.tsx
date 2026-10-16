import { AuthShell } from "@/components/AuthShell";
import { redirect } from "next/navigation";
import { defaultDestination } from "@/lib/landing";
import { afterVerify } from "@/lib/nextPath";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { captureProductEvent } from "@/lib/analytics";
import {
  consumeVerificationToken,
  validateVerificationToken,
} from "@/lib/emailVerification";
import { VerifyEmailStandby } from "@/components/VerifyEmailStandby";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your email — inturview" };

interface VerifyEmailPageProps {
  searchParams: { token?: string; next?: string };
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const user = await requireUser();
  const intended = afterVerify(searchParams.next);
  const here = `/verify-email${searchParams.token || intended ? "?" : ""}${[searchParams.token && `token=${encodeURIComponent(searchParams.token)}`, intended && `next=${encodeURIComponent(intended)}`].filter(Boolean).join("&")}`;
  if (!user) redirect(`/signin?callbackUrl=${encodeURIComponent(here)}`);

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, emailVerifiedAt: true, onboardingCompletedAt: true },
  });
  if (!profile) redirect("/signin");

  // An explicit destination (e.g. a teammate invitation) wins over practice onboarding.
  const next = intended ?? (await defaultDestination(user.id, profile.onboardingCompletedAt));

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
          <AuthShell>
            <VerifyEmailStandby
              email={profile.email}
              next={intended}
              topMessage={{
                tone: "error",
                text: "That verification link belongs to a different account. Sign out and try the link again, or request a fresh one below.",
              }}
            />
          </AuthShell>
        );
      }
      await consumeVerificationToken({
        tokenId: result.tokenId,
        userId: user.id,
      });
      await captureProductEvent(user.id, { event: "email_verified" });
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
      <AuthShell>
        <VerifyEmailStandby
          email={profile.email}
          next={intended}
          topMessage={{ tone: "error", text: reasonText }}
        />
      </AuthShell>
    );
  }

  // No token in URL — standby state, prompt to check inbox / resend.
  return (
    <AuthShell>
      <VerifyEmailStandby email={profile.email} next={intended} />
    </AuthShell>
  );
}
