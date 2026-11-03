import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { OwnerInviteForm, SupportAccessForm } from "@/components/admin/OrganizationForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace — inturview admin" };

const fmt = (d: Date) => d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default async function OrganizationPage({ params, searchParams }: { params: { id: string }; searchParams: { emailFailed?: string } }) {
  const admin = await requireAdmin();
  if (!admin) notFound();
  const now = new Date();
  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      contactEmail: true,
      designPartner: true,
      createdAt: true,
      // Operators see who is in a workspace (to support them) but not its hiring data.
      members: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, createdAt: true, user: { select: { email: true, name: true } } } },
      memberInvitations: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true, createdAt: true } },
      supportGrants: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, reason: true, expiresAt: true, endedAt: true, createdAt: true, operatorId: true, operator: { select: { email: true } } } },
    },
  });
  if (!org) notFound();
  const hasOwner = org.members.some((m) => m.role === "OWNER");
  const mine = org.supportGrants.find((g) => g.operatorId === admin.id && !g.endedAt && g.expiresAt > now);

  return (
    <div className="space-y-6">
      <Link href="/admin/organizations" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text">
        <ArrowLeft className="h-3.5 w-3.5" /> Workspaces
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-sm text-text-muted mt-1 font-mono">/hire/{org.slug}</p>
        <p className="text-xs text-text-dim mt-1">
          {org.designPartner ? "Design partner" : "Customer"} · {org.timezone} · created {fmt(org.createdAt)}
        </p>
      </header>

      {searchParams.emailFailed && (
        <p role="alert" className="panel p-3 text-sm text-hard">The workspace was created, but the owner invitation email didn&apos;t send. Send it again below.</p>
      )}

      {!hasOwner && (
        <section className="panel p-5 space-y-3">
          <h2 className="text-sm font-semibold">Owner not joined yet</h2>
          <p className="text-sm text-text-muted">Sending again withdraws the earlier link.</p>
          <OwnerInviteForm orgId={org.id} defaultEmail={org.memberInvitations.find((i) => i.role === "OWNER")?.email ?? org.contactEmail ?? ""} />
        </section>
      )}

      <section className="panel overflow-hidden">
        <h2 className="text-sm font-semibold px-4 pt-4 pb-2">Members</h2>
        <ul>
          {org.members.map((m) => (
            <li key={m.id} className="flex justify-between gap-3 px-4 py-2.5 border-t border-border text-sm">
              <span className="truncate">{m.user.name ? `${m.user.name} · ` : ""}{m.user.email}</span>
              <span className="text-text-muted">{ROLE_LABELS[m.role]}</span>
            </li>
          ))}
          {org.members.length === 0 && <li className="px-4 py-3 border-t border-border text-sm text-text-dim">Nobody has joined yet.</li>}
        </ul>
      </section>

      <section className="panel overflow-hidden">
        <h2 className="text-sm font-semibold px-4 pt-4 pb-2">Invitations</h2>
        <ul>
          {org.memberInvitations.map((i) => (
            <li key={i.id} className="flex flex-wrap justify-between gap-3 px-4 py-2.5 border-t border-border text-sm">
              <span className="truncate">{i.email} · {ROLE_LABELS[i.role]}</span>
              <span className="text-xs text-text-dim">
                {i.acceptedAt ? `accepted ${fmt(i.acceptedAt)}` : i.revokedAt ? "withdrawn" : i.expiresAt <= now ? "expired" : `pending, expires ${fmt(i.expiresAt)}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-5 space-y-3">
        <h2 className="text-sm font-semibold">Support access</h2>
        <SupportAccessForm orgId={org.id} active={mine ? { expiresAt: mine.expiresAt.toISOString(), slug: org.slug } : null} />
        {org.supportGrants.length > 0 && (
          <ul className="text-xs text-text-dim space-y-1 pt-2">
            {org.supportGrants.map((g) => (
              <li key={g.id}>
                {fmt(g.createdAt)} · {g.operator.email} · {g.endedAt ? "ended" : g.expiresAt <= now ? "expired" : "active"} · {g.reason}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
