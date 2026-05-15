import { prisma } from "./db";

export type AuditAction =
  | "PROBLEM_CREATED"
  | "PROBLEM_UPDATED"
  | "PROBLEM_DELETED"
  | "USER_FLAGGED"
  | "USER_UNFLAGGED"
  | "USER_DISABLED"
  | "USER_ENABLED"
  | "USER_ROLE_CHANGED"
  | "USER_DELETED"
  | "INTERVIEW_DELETED";

export type AuditTargetType = "user" | "problem" | "interview";

export async function writeAudit(opts: {
  adminId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  metadata?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: opts.adminId,
        action: opts.action,
        targetType: opts.targetType,
        targetId: opts.targetId,
        metadata: (opts.metadata as object | undefined) ?? undefined,
      },
    });
  } catch {
    // Audit logging must never block the underlying admin action. If the write
    // fails (e.g. db blip), we swallow rather than 500 the request.
  }
}
