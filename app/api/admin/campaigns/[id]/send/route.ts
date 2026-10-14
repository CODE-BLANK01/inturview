import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sendNextBatch } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Sends one batch; the admin screen keeps calling while `remaining` is above zero. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { retryFailed } = z.object({ retryFailed: z.boolean().default(false) }).parse((await req.json().catch(() => ({}))) ?? {});
  if (!(await prisma.campaign.count({ where: { id: params.id } }))) return Response.json({ error: "Campaign not found" }, { status: 404 });
  try {
    const result = await sendNextBatch(params.id, { retryFailed });
    if (result.sent || result.failed) {
      await writeAudit({ adminId: admin.id, action: "INVITES_SENT", targetType: "campaign", targetId: params.id, metadata: result });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[campaigns/send]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Sending failed. Nothing was lost; try again." }, { status: 502 });
  }
}
