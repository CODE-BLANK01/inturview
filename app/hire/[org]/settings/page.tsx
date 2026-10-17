import { accessAllows } from "@/lib/workspaces";
import { requireWorkspace } from "@/lib/workspaceGuard";
import { WorkspaceSettingsForm } from "@/components/hire/WorkspaceSettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: { org: string } }) {
  const access = await requireWorkspace(params.org);
  const { org } = access;
  const canEdit = !!access.role && accessAllows(access, "workspace.editProfile");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-text-muted mt-1">
          {canEdit ? "What applicants see about your company." : "Only owners and workspace admins can change these."}
        </p>
      </header>
      <WorkspaceSettingsForm
        slug={org.slug}
        readOnly={!canEdit}
        initial={{
          name: org.name,
          timezone: org.timezone,
          website: org.website ?? "",
          logoUrl: org.logoUrl ?? "",
          contactEmail: org.contactEmail ?? "",
        }}
      />
      {access.role === "OWNER" && (
        <section className="panel p-5 max-w-2xl">
          <h2 className="text-sm font-semibold">Billing</h2>
          <p className="text-sm text-text-muted mt-1">
            {org.designPartner
              ? "You're a design partner. There's nothing to pay while we build this with you."
              : "Billing isn't set up for this workspace yet. Contact us to arrange it."}
          </p>
        </section>
      )}
    </div>
  );
}
