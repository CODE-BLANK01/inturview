import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const filter = url.searchParams.get("filter"); // "flagged" | "disabled" | "admin"

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filter === "flagged") where.flagged = true;
  if (filter === "disabled") where.disabledAt = { not: null };
  if (filter === "admin") where.role = "ADMIN";

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      flagged: true,
      flagReason: true,
      disabledAt: true,
      createdAt: true,
      _count: { select: { interviews: true } },
    },
  });
  return Response.json({ users });
}
