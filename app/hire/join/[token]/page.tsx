import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLE_BLURBS, ROLE_LABELS } from "@/lib/permissions";
import { findMemberInvitation, normalizeEmail } from "@/lib/workspaces";
import { AcceptInvitationButton, SignOutAndSwitch } from "@/components/hire/JoinControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join a workspace — inturview", robots: { index: false } };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="panel p-8 max-w-md w-full space-y-5">{children}</div>
    </main>
  );
}

const DEAD: Record<string, { title: string; body: string }> = {
  unknown: { title: "This link isn't valid", body: "Check you copied the whole link, or ask your teammate to invite you again." },
  revoked: { title: "This invitation was withdrawn", body: "A newer invitation may have been sent. Ask your teammate to invite you again." },
  expired: { title: "This invitation has expired", body: "Invitations last 7 days. Ask your teammate to send a new one." },
};

export default async function JoinPage({ params }: { params: { token: string } }) {
  const found = await findMemberInvitation(params.token);
  if (found.state !== "valid" && found.state !== "accepted") {
    const d = DEAD[found.state];
    return (
      <Card>
        <h1 className="text-xl font-semibold">{d.title}</h1>
        <p className="text-sm text-text-muted">{d.body}</p>
      </Card>
    );
  }
  const { invitation } = found;
  const here = `/hire/join/${params.token}`;
  const user = await requireUser();

  if (found.state === "accepted") {
    if (user) {
      const member = await prisma.organizationMember.findFirst({
        where: { userId: user.id, organization: { slug: invitation.organization.slug } },
        select: { id: true },
      });
      if (member) redirect(`/hire/${invitation.organization.slug}`);
    }
    return (
      <Card>
        <h1 className="text-xl font-semibold">This invitation has been used</h1>
        <p className="text-sm text-text-muted">
          If that was you, <Link className="underline" href={`/signin?callbackUrl=${encodeURIComponent("/hire")}`}>sign in</Link> to open your workspace.
        </p>
      </Card>
    );
  }

  const heading = (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-accent">
        <Building2 className="h-4 w-4" /> inturview hire
      </div>
      <h1 className="text-xl font-semibold">Join {invitation.organization.name}</h1>
      <p className="text-sm text-text-muted">
        You&apos;re invited as {ROLE_LABELS[invitation.role].toLowerCase()}. {ROLE_BLURBS[invitation.role]}
      </p>
    </div>
  );

  if (!user) {
    const q = `callbackUrl=${encodeURIComponent(here)}&email=${encodeURIComponent(invitation.email)}`;
    return (
      <Card>
        {heading}
        <p className="text-sm">
          This invitation is for <strong>{invitation.email}</strong>. Sign in or create an account with that email to accept.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/signin?${q}`} className="btn btn-primary text-sm">Sign in</Link>
          <Link href={`/signup?${q}`} className="btn text-sm">Create an account</Link>
        </div>
        <p className="text-xs text-text-dim">Joining a workspace doesn&apos;t share your practice history with the company.</p>
      </Card>
    );
  }

  if (normalizeEmail(user.email) !== invitation.email) {
    return (
      <Card>
        {heading}
        <p className="text-sm">
          You&apos;re signed in as <strong>{user.email}</strong>, but this invitation is for <strong>{invitation.email}</strong>.
        </p>
        <SignOutAndSwitch to={`/signin?callbackUrl=${encodeURIComponent(here)}&email=${encodeURIComponent(invitation.email)}`} />
      </Card>
    );
  }

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true } });
  if (!row?.emailVerifiedAt) redirect(`/verify-email?next=${encodeURIComponent(here)}`);

  return (
    <Card>
      {heading}
      <AcceptInvitationButton token={params.token} />
      <p className="text-xs text-text-dim">Joining a workspace doesn&apos;t share your practice history with the company.</p>
    </Card>
  );
}
