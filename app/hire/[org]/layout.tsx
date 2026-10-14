import { HireShell } from "@/components/hire/HireShell";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/workspaceGuard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Hire — inturview", robots: { index: false } };

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: { org: string } }) {
  const access = await requireWorkspace(params.org);
  const workspaces = await prisma.organizationMember.count({ where: { userId: access.user.id } });
  return (
    <HireShell
      org={{ name: access.org.name, slug: access.org.slug }}
      roleLabel={access.role ? ROLE_LABELS[access.role] : "Support access"}
      user={{ email: access.user.email, name: access.user.name }}
      support={access.support ? { expiresAt: access.support.expiresAt.toISOString(), reason: access.support.reason } : null}
      canSwitch={workspaces > 1}
    >
      {children}
    </HireShell>
  );
}
