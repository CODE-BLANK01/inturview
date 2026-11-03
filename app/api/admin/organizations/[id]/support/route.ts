import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { endSupportAccess, grantSupportAccess, SUPPORT_GRANT_MAX_HOURS, workspaceErrorResponse } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Grant = z.object({
  reason: z.string().trim().max(1000),
  hours: z.number().int().min(1).max(SUPPORT_GRANT_MAX_HOURS).default(2),
});

/** Operators have no workspace access until they take a time-boxed, reasoned grant. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Grant.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const org = await prisma.organization.findUnique({ where: { id: params.id }, select: { slug: true } });
  if (!org) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const grant = await grantSupportAccess({ organizationId: params.id, operatorId: admin.id, ...parsed.data });
    await writeAudit({ adminId: admin.id, action: "SUPPORT_ACCESS_GRANTED", targetType: "organization", targetId: params.id, metadata: { grantId: grant.id, reason: parsed.data.reason, expiresAt: grant.expiresAt } });
    return Response.json({ slug: org.slug, expiresAt: grant.expiresAt });
  } catch (e) {
    return workspaceErrorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  await endSupportAccess(params.id, admin.id);
  await writeAudit({ adminId: admin.id, action: "SUPPORT_ACCESS_ENDED", targetType: "organization", targetId: params.id });
  return Response.json({ ok: true });
}
