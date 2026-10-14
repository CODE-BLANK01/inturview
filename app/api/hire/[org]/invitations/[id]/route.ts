import { NextRequest } from "next/server";
import { writeAudit } from "@/lib/audit";
import { workspaceApi } from "@/lib/workspaceGuard";
import { revokeMemberInvitation, workspaceErrorResponse } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { org: string; id: string } }) {
  const guard = await workspaceApi(params.org, "members.manageStaff");
  if (!guard.ok) return guard.response;
  const { access, user } = guard;
  try {
    await revokeMemberInvitation(access.org.id, params.id, access.role!);
    await writeAudit({ adminId: user.id, action: "MEMBER_INVITE_REVOKED", targetType: "member_invitation", targetId: params.id, metadata: { organizationId: access.org.id } });
    return Response.json({ ok: true });
  } catch (e) {
    return workspaceErrorResponse(e);
  }
}
