import { NextRequest } from "next/server";
import { z } from "zod";
import { OrgRole } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { workspaceApi } from "@/lib/workspaceGuard";
import { changeMemberRole, removeMember, workspaceErrorResponse } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({ role: z.nativeEnum(OrgRole) });

export async function PATCH(req: NextRequest, { params }: { params: { org: string; id: string } }) {
  const guard = await workspaceApi(params.org, "members.manageStaff");
  if (!guard.ok) return guard.response;
  const { access, user } = guard;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a role." }, { status: 400 });
  try {
    await changeMemberRole({ organizationId: access.org.id, memberId: params.id, role: parsed.data.role, actorRole: access.role! });
    await writeAudit({ adminId: user.id, action: "MEMBER_ROLE_CHANGED", targetType: "member", targetId: params.id, metadata: { organizationId: access.org.id, role: parsed.data.role } });
    return Response.json({ ok: true });
  } catch (e) {
    return workspaceErrorResponse(e);
  }
}

/** Remove a teammate, or leave the workspace yourself. */
export async function DELETE(_req: NextRequest, { params }: { params: { org: string; id: string } }) {
  const guard = await workspaceApi(params.org, "workspace.view");
  if (!guard.ok) return guard.response;
  const { access, user } = guard;
  if (!access.role) return Response.json({ error: "Support access is read-only." }, { status: 403 });
  try {
    await removeMember({ organizationId: access.org.id, memberId: params.id, actorRole: access.role, actorUserId: user.id });
    await writeAudit({ adminId: user.id, action: "MEMBER_REMOVED", targetType: "member", targetId: params.id, metadata: { organizationId: access.org.id } });
    return Response.json({ ok: true });
  } catch (e) {
    return workspaceErrorResponse(e);
  }
}
