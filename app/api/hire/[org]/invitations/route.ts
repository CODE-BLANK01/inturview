import { NextRequest } from "next/server";
import { z } from "zod";
import { OrgRole } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { workspaceApi } from "@/lib/workspaceGuard";
import { inviteMember, workspaceErrorResponse } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().trim().email("Enter a work email."),
  role: z.nativeEnum(OrgRole),
});

export async function POST(req: NextRequest, { params }: { params: { org: string } }) {
  const guard = await workspaceApi(params.org, "members.manageStaff");
  if (!guard.ok) return guard.response;
  const { access, user } = guard;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid invitation" }, { status: 400 });
  try {
    const invite = await inviteMember({ organizationId: access.org.id, ...parsed.data, invitedById: user.id, actorRole: access.role });
    await writeAudit({ adminId: user.id, action: "MEMBER_INVITED", targetType: "member_invitation", targetId: invite.invitationId, metadata: { organizationId: access.org.id, role: parsed.data.role } });
    return Response.json({ emailed: invite.emailed, emailError: invite.emailError });
  } catch (e) {
    return workspaceErrorResponse(e);
  }
}
