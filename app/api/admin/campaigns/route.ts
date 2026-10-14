import { NextRequest } from "next/server";
import { z } from "zod";
import { LoopStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { addRecipients } from "@/lib/invites";
import { RecipientsSchema } from "@/lib/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({
  loopTemplateId: z.string().min(1),
  name: z.string().trim().min(2, "Name the campaign.").max(120),
  message: z.string().trim().max(2000).nullable().default(null),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null)
    .refine((d) => !d || new Date(`${d}T23:59:59Z`) > new Date(), "The deadline must be in the future."),
  recipients: RecipientsSchema,
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid campaign" }, { status: 400 });
  const d = parsed.data;

  const loop = await prisma.loopTemplate.findUnique({ where: { id: d.loopTemplateId }, select: { status: true, currentVersion: true } });
  if (!loop) return Response.json({ error: "Loop not found" }, { status: 404 });
  if (loop.status !== LoopStatus.PUBLISHED || loop.currentVersion === 0) {
    return Response.json({ error: "Publish the loop before inviting candidates." }, { status: 409 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      loopTemplateId: d.loopTemplateId,
      loopVersion: loop.currentVersion,
      name: d.name,
      message: d.message,
      deadline: d.deadline ? new Date(`${d.deadline}T23:59:59Z`) : null,
      createdById: admin.id,
    },
  });
  const { added, skipped } = await addRecipients(campaign.id, d.recipients);
  await writeAudit({ adminId: admin.id, action: "CAMPAIGN_CREATED", targetType: "campaign", targetId: campaign.id, metadata: { loopVersion: loop.currentVersion, added } });
  return Response.json({ id: campaign.id, added, skipped }, { status: 201 });
}
