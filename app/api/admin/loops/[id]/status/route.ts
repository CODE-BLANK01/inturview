import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { LoopNotReadyError, publishLoop, setLoopArchived } from "@/lib/loopTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ action: z.enum(["publish", "archive", "restore"]) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Unknown action" }, { status: 400 });
  const exists = await prisma.loopTemplate.count({ where: { id: params.id } });
  if (!exists) return Response.json({ error: "Loop not found" }, { status: 404 });

  if (parsed.data.action === "publish") {
    try {
      const loop = await publishLoop(params.id, admin.id);
      await writeAudit({ adminId: admin.id, action: "LOOP_PUBLISHED", targetType: "loop", targetId: params.id, metadata: { version: loop.currentVersion } });
      return Response.json({ status: loop.status, version: loop.currentVersion });
    } catch (e) {
      if (e instanceof LoopNotReadyError) return Response.json({ error: e.message, problems: e.problems }, { status: 409 });
      if ((e as { code?: string }).code === "P2002") return Response.json({ error: "Already published. Refresh to see the latest version." }, { status: 409 });
      throw e;
    }
  }
  const archived = parsed.data.action === "archive";
  const loop = await setLoopArchived(params.id, archived);
  await writeAudit({ adminId: admin.id, action: archived ? "LOOP_ARCHIVED" : "LOOP_RESTORED", targetType: "loop", targetId: params.id });
  return Response.json({ status: loop.status, version: loop.currentVersion });
}
