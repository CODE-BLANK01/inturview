import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { createDesignPartnerWorkspace, workspaceErrorResponse } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({
  name: z.string().trim().min(2, "Name the company.").max(120),
  slug: z.string().trim().toLowerCase().max(40).optional().transform((s) => s || undefined),
  ownerEmail: z.string().trim().email("Enter the owner's work email."),
  timezone: z.string().trim().max(64).refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz) || tz === "UTC", "Unknown timezone").default("UTC"),
});

/** D1: an operator creates a design-partner workspace and invites its owner. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid workspace" }, { status: 400 });
  try {
    const { org, invite } = await createDesignPartnerWorkspace({ ...parsed.data, operatorId: admin.id });
    await writeAudit({ adminId: admin.id, action: "ORG_CREATED", targetType: "organization", targetId: org.id, metadata: { slug: org.slug, designPartner: true } });
    await writeAudit({ adminId: admin.id, action: "MEMBER_INVITED", targetType: "member_invitation", targetId: invite.invitationId, metadata: { organizationId: org.id, role: "OWNER" } });
    return Response.json({ id: org.id, slug: org.slug, emailed: invite.emailed, emailError: invite.emailError });
  } catch (e) {
    return workspaceErrorResponse(e);
  }
}
