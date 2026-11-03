import { NextRequest } from "next/server";
import { z } from "zod";
import { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { inviteMember, workspaceErrorResponse } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().trim().email("Enter the owner's work email.") });

/** Re-sends (or redirects) the owner invitation while a design partner is being set up. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid email" }, { status: 400 });
  const owners = await prisma.organizationMember.count({ where: { organizationId: params.id, role: OrgRole.OWNER } });
  // Once the company has an owner, they manage their own team.
  if (owners > 0) return Response.json({ error: "This workspace already has an owner." }, { status: 409 });
  try {
    const invite = await inviteMember({ organizationId: params.id, email: parsed.data.email, role: OrgRole.OWNER, invitedById: admin.id, actorRole: null });
    await writeAudit({ adminId: admin.id, action: "MEMBER_INVITED", targetType: "member_invitation", targetId: invite.invitationId, metadata: { organizationId: params.id, role: "OWNER" } });
    return Response.json({ emailed: invite.emailed, emailError: invite.emailError });
  } catch (e) {
    return workspaceErrorResponse(e);
  }
}
