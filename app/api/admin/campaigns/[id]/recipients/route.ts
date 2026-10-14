import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { addRecipients } from "@/lib/invites";
import { RecipientsSchema } from "@/lib/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ recipients: RecipientsSchema }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid list" }, { status: 400 });
  if (!(await prisma.campaign.count({ where: { id: params.id } }))) return Response.json({ error: "Campaign not found" }, { status: 404 });
  const result = await addRecipients(params.id, parsed.data.recipients);
  await writeAudit({ adminId: admin.id, action: "CAMPAIGN_RECIPIENTS_ADDED", targetType: "campaign", targetId: params.id, metadata: result });
  return Response.json(result);
}
