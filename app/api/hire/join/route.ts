import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { acceptMemberInvitation, workspaceErrorResponse } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(10).max(100) });

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Sign in to accept." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "This invitation link isn't valid." }, { status: 400 });
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true } });
  try {
    const { slug, organizationId } = await acceptMemberInvitation(parsed.data.token, { id: user.id, email: user.email, emailVerified: !!row?.emailVerifiedAt });
    await writeAudit({ adminId: user.id, action: "MEMBER_JOINED", targetType: "organization", targetId: organizationId });
    return Response.json({ slug });
  } catch (e) {
    return workspaceErrorResponse(e);
  }
}
