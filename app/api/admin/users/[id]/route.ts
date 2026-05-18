import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit, type AuditAction } from "@/lib/audit";
import { UpdateUserSchema } from "@/lib/adminSchemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let parsed;
  try {
    parsed = UpdateUserSchema.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, role: true, flagged: true, disabledAt: true },
  });
  if (!target) return Response.json({ error: "Not found" }, { status: 404 });

  // Safety: don't let an admin disable / demote themselves out of an admin lock-out.
  if (target.id === admin.id) {
    if (parsed.disabled === true || parsed.role === "USER") {
      return Response.json(
        { error: "You can't disable or demote your own admin account." },
        { status: 400 }
      );
    }
  }

  const data: Record<string, unknown> = {};
  const auditActions: { action: AuditAction; metadata?: unknown }[] = [];
  // Any admin action that changes the target's authorization surface
  // (disable, role demotion/promotion) revokes their outstanding JWTs so the
  // change takes effect on their very next request — not 30 days later.
  let revokeSessions = false;

  if (typeof parsed.flagged === "boolean") {
    data.flagged = parsed.flagged;
    data.flagReason = parsed.flagged ? parsed.flagReason ?? null : null;
    if (parsed.flagged !== target.flagged) {
      auditActions.push({
        action: parsed.flagged ? "USER_FLAGGED" : "USER_UNFLAGGED",
        metadata: parsed.flagged ? { reason: parsed.flagReason } : undefined,
      });
    }
  }
  if (typeof parsed.disabled === "boolean") {
    data.disabledAt = parsed.disabled ? new Date() : null;
    if (parsed.disabled !== (target.disabledAt !== null)) {
      auditActions.push({
        action: parsed.disabled ? "USER_DISABLED" : "USER_ENABLED",
      });
      if (parsed.disabled) revokeSessions = true;
    }
  }
  if (parsed.role) {
    data.role = parsed.role as Role;
    if (parsed.role !== target.role) {
      auditActions.push({
        action: "USER_ROLE_CHANGED",
        metadata: { from: target.role, to: parsed.role },
      });
      revokeSessions = true;
    }
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ ok: true, user: target });
  }
  if (revokeSessions) {
    (data as { tokenVersion?: unknown }).tokenVersion = { increment: 1 };
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      flagged: true,
      flagReason: true,
      disabledAt: true,
    },
  });

  for (const a of auditActions) {
    await writeAudit({
      adminId: admin.id,
      action: a.action,
      targetType: "user",
      targetId: target.id,
      metadata: { email: target.email, ...(a.metadata as object | undefined) },
    });
  }

  return Response.json({ user: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (params.id === admin.id) {
    return Response.json({ error: "You can't delete your own account here." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true },
  });
  if (!target) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.user.delete({ where: { id: params.id } });
  await writeAudit({
    adminId: admin.id,
    action: "USER_DELETED",
    targetType: "user",
    targetId: target.id,
    metadata: { email: target.email },
  });
  return Response.json({ ok: true });
}
