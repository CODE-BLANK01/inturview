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
  | "INTERVIEW_DELETED"
  | "QUESTION_CREATED"
  | "QUESTION_UPDATED"
  | "QUESTION_PUBLISHED"
  | "QUESTION_RETIRED"
  | "QUESTION_RESTORED"
  | "QUESTIONS_DRAFTED"
  | "LOOP_CREATED"
  | "LOOP_UPDATED"
  | "LOOP_PUBLISHED"
  | "LOOP_ARCHIVED"
  | "LOOP_RESTORED"
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "CAMPAIGN_CREATED"
  | "CAMPAIGN_RECIPIENTS_ADDED"
  | "INVITES_SENT"
  | "INVITE_RESENT"
  | "INVITE_REVOKED"
  | "ROUND_RESCORED"
  | "ORG_CREATED"
  | "ORG_UPDATED"
  | "MEMBER_INVITED"
  | "MEMBER_INVITE_REVOKED"
  | "MEMBER_JOINED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_REMOVED"
  | "SUPPORT_ACCESS_GRANTED"
  | "SUPPORT_ACCESS_ENDED";

export type AuditTargetType = "user" | "problem" | "interview" | "question" | "loop" | "campaign" | "invite" | "organization" | "member" | "member_invitation" | "role";

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
