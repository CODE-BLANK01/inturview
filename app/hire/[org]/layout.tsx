import { HireShell, type HireNavKey } from "@/components/hire/HireShell";
import { HiringPathsProvider } from "@/components/hiring/HiringPaths";
import { workspacePaths } from "@/lib/hiring/paths";
import { accessAllows } from "@/lib/workspaces";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/workspaceGuard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Hire — inturview", robots: { index: false } };

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: { org: string } }) {
  const access = await requireWorkspace(params.org);
  const workspaces = await prisma.organizationMember.count({ where: { userId: access.user.id } });
  const nav: HireNavKey[] = [
    "overview",
    ...(accessAllows(access, "applications.viewAll") ? (["roles", "candidates"] as const) : []),
    ...(accessAllows(access, "loops.edit") ? (["loops"] as const) : []),
    ...(accessAllows(access, "questions.edit") ? (["questions"] as const) : []),
    "team",
    "settings",
  ];
  return (
    <HireShell
      org={{ name: access.org.name, slug: access.org.slug }}
      roleLabel={access.role ? ROLE_LABELS[access.role] : "Support access"}
      user={{ email: access.user.email, name: access.user.name }}
      support={access.support ? { expiresAt: access.support.expiresAt.toISOString(), reason: access.support.reason } : null}
      canSwitch={workspaces > 1}
      nav={nav}
    >
      <HiringPathsProvider value={workspacePaths(access.org.slug)}>{children}</HiringPathsProvider>
    </HireShell>
  );
}
