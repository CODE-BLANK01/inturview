import Link from "next/link";
import { prisma } from "@/lib/db";
import { NewWorkspaceForm } from "@/components/admin/OrganizationForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspaces — inturview admin" };

export default async function OrganizationsPage() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      designPartner: true,
      createdAt: true,
      _count: { select: { members: true } },
      memberInvitations: { where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } },
    },
  });
  const legacyCampaigns = await prisma.campaign.count({ where: { organizationId: null } });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
        <p className="text-sm text-text-muted mt-1">
          Companies using Hire. Operators can see this list but not inside a workspace without support access.
        </p>
      </header>
      <NewWorkspaceForm />
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-text-dim">
                {["Workspace", "Members", "Pending invites", "Created"].map((h, i) => (
                  <th key={h} className={`font-medium text-xs uppercase tracking-[0.06em] px-4 py-2.5 ${i ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-bg-inset/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/organizations/${o.id}`} className="font-medium hover:underline underline-offset-2">{o.name}</Link>
                    <span className="ml-2 text-xs text-text-dim font-mono">/hire/{o.slug}</span>
                    {o.designPartner && <span className="ml-2 text-xs text-accent">design partner</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{o._count.members}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-muted">{o.memberInvitations.length}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-dim">{o.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr><td colSpan={4} className="text-center text-text-dim py-8">No workspaces yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {legacyCampaigns > 0 && (
        <p className="text-xs text-text-dim">
          {legacyCampaigns} test campaign{legacyCampaigns === 1 ? "" : "s"} from before workspaces belong to no company and stay under{" "}
          <Link href="/admin/campaigns" className="underline underline-offset-2">Invites</Link>. They are never assigned to a workspace automatically.
        </p>
      )}
    </div>
  );
}
