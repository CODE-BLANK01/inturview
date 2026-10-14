import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { InviteActionError, resendInvite, revokeInvite } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ action: z.enum(["resend", "revoke"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Unknown action" }, { status: 400 });
  if (!(await prisma.invite.count({ where: { id: params.id } }))) return Response.json({ error: "Invite not found" }, { status: 404 });
  try {
    if (parsed.data.action === "revoke") {
      await revokeInvite(params.id);
      await writeAudit({ adminId: admin.id, action: "INVITE_REVOKED", targetType: "invite", targetId: params.id });
      return Response.json({ ok: true });
    }
    const { sent } = await resendInvite(params.id);
    await writeAudit({ adminId: admin.id, action: "INVITE_RESENT", targetType: "invite", targetId: params.id, metadata: { sent } });
    return sent ? Response.json({ ok: true }) : Response.json({ error: "The email didn't go through. Check the address and try again." }, { status: 502 });
  } catch (e) {
    if (e instanceof InviteActionError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
