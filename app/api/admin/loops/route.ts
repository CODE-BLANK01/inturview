import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({ name: z.string().trim().min(2, "Name the loop.").max(120) });

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid loop" }, { status: 400 });
  const loop = await prisma.loopTemplate.create({ data: { name: parsed.data.name, createdById: admin.id } });
  await writeAudit({ adminId: admin.id, action: "LOOP_CREATED", targetType: "loop", targetId: loop.id, metadata: { name: loop.name } });
  return Response.json({ id: loop.id }, { status: 201 });
}
