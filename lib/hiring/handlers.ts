// Hiring API handlers shared by Admin (the platform library, organizationId
// null) and Hire workspaces. Every lookup by ID is filtered by the caller's
// organization, so an ID from another workspace is simply "not found".
import { NextRequest } from "next/server";
import { z } from "zod";
import { LoopStatus, Prisma, QuestionCategory, QuestionSource, QuestionStatus } from "@prisma/client";
import { prisma } from "../db";
import { writeAudit, type AuditAction, type AuditTargetType } from "../audit";
import { checkRateLimit } from "../rateLimit";
import {
  createQuestion,
  LEVELS,
  publishQuestion,
  QuestionInputSchema,
  QuestionRetiredError,
  questionFilterWhere,
  questionWhere,
  restoreQuestion,
  retireQuestion,
  updateQuestion,
  usableQuestionsWhere,
} from "../questionBank";
import { DRAFT_MODEL, generateDrafts } from "../questionDrafts";
import {
  checkReadiness,
  freezeLoop,
  LoopChangedError,
  LoopEditSchema,
  LoopNotReadyError,
  LoopTransitionError,
  poolWhere,
  publishedRounds,
  publishLoop,
  setLoopArchived,
} from "../loopTemplates";
import { addRecipients, InviteActionError, newInviteToken, resendInvite, revokeInvite } from "../invites";
import { processDeliveries, queueCampaign, remainingFor } from "../delivery";
import { RecipientsSchema } from "../recipients";
import { rescoreRound } from "../scoring";

export interface HiringCtx {
  /** null: the platform library, managed by operators. */
  organizationId: string | null;
  actorId: string;
  /** May see every candidate in the workspace (reviewers see only their assignments). */
  canViewAll?: boolean;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const notFound = (what: string) => json({ error: `${what} not found` }, 404);
const body = (req: NextRequest) => req.json().catch(() => null);
const firstIssue = (e: z.ZodError, fallback: string) => {
  const issue = e.issues[0];
  return issue ? (issue.path.length ? `${issue.path.join(" › ")}: ${issue.message}` : issue.message) : fallback;
};

function audit(ctx: HiringCtx, action: AuditAction, targetType: AuditTargetType, targetId: string, metadata: Record<string, unknown> = {}) {
  return writeAudit({ adminId: ctx.actorId, action, targetType, targetId, metadata: { ...metadata, organizationId: ctx.organizationId } });
}

const ownQuestion = (ctx: HiringCtx, id: string) => prisma.question.count({ where: { id, organizationId: ctx.organizationId } });
const ownLoop = (ctx: HiringCtx, id: string) => prisma.loopTemplate.count({ where: { id, organizationId: ctx.organizationId } });
const ownCampaign = (ctx: HiringCtx, id: string) => prisma.campaign.count({ where: { id, organizationId: ctx.organizationId } });

const pick = <T extends string>(values: Record<string, T>, v: string | null) =>
  v && (Object.values(values) as string[]).includes(v) ? (v as T) : undefined;

// ── Questions ───────────────────────────────────────────────────────────────

/** `?library=1` lists the published inturview library instead of the caller's own questions. */
export async function listQuestions(ctx: HiringCtx, req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filters = {
    category: pick(QuestionCategory, sp.get("category")),
    status: pick(QuestionStatus, sp.get("status")),
    source: pick(QuestionSource, sp.get("source")),
    q: sp.get("q")?.trim() || undefined,
  };
  const where =
    sp.get("usable") === "1"
      ? // The loop builder's picker: everything this owner's loops may use.
        { AND: [usableQuestionsWhere(ctx.organizationId), questionFilterWhere(filters)] }
      : sp.get("library") === "1"
        ? questionWhere({ ...filters, status: QuestionStatus.PUBLISHED }, null)
        : questionWhere(filters, ctx.organizationId);
  const questions = await prisma.question.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
    select: { id: true, category: true, title: true, status: true, source: true, currentVersion: true, tags: true, difficulty: true, updatedAt: true, organizationId: true },
  });
  return json({ questions: questions.map(({ organizationId, ...q }) => ({ ...q, library: organizationId === null && ctx.organizationId !== null })) });
}

export async function createQuestionHandler(ctx: HiringCtx, req: NextRequest) {
  const parsed = QuestionInputSchema.safeParse(await body(req));
  if (!parsed.success) return json({ error: firstIssue(parsed.error, "Invalid question") }, 400);
  const created = await createQuestion(parsed.data, { createdById: ctx.actorId, organizationId: ctx.organizationId });
  await audit(ctx, "QUESTION_CREATED", "question", created.id, { title: created.title });
  return json({ id: created.id }, 201);
}

export async function getQuestion(ctx: HiringCtx, id: string) {
  const question = await prisma.question.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: { versions: { orderBy: { version: "desc" }, select: { version: true, publishedAt: true, publishedById: true } } },
  });
  return question ? json({ question }) : notFound("Question");
}

export async function updateQuestionHandler(ctx: HiringCtx, req: NextRequest, id: string) {
  const parsed = QuestionInputSchema.safeParse(await body(req));
  if (!parsed.success) return json({ error: firstIssue(parsed.error, "Invalid question") }, 400);
  if (!(await ownQuestion(ctx, id))) return notFound("Question");
  await updateQuestion(id, parsed.data);
  await audit(ctx, "QUESTION_UPDATED", "question", id);
  return json({ ok: true });
}

const QuestionAction = z.object({ action: z.enum(["publish", "retire", "restore"]) });

export async function questionStatusHandler(ctx: HiringCtx, req: NextRequest, id: string) {
  const parsed = QuestionAction.safeParse(await body(req));
  if (!parsed.success) return json({ error: "Unknown action" }, 400);
  if (!(await ownQuestion(ctx, id))) return notFound("Question");
  const { action } = parsed.data;
  if (action === "publish") {
    try {
      const q = await publishQuestion(id, ctx.actorId);
      await audit(ctx, "QUESTION_PUBLISHED", "question", id, { version: q.currentVersion });
      return json({ status: q.status, version: q.currentVersion });
    } catch (e) {
      if (e instanceof QuestionRetiredError) return json({ error: e.message }, 409);
      // P2002: someone published the same version a moment ago.
      if ((e as { code?: string }).code === "P2002") return json({ error: "Already published. Refresh to see the latest version." }, 409);
      throw e;
    }
  }
  const q = action === "retire" ? await retireQuestion(id) : await restoreQuestion(id);
  await audit(ctx, action === "retire" ? "QUESTION_RETIRED" : "QUESTION_RESTORED", "question", id);
  return json({ status: q.status, version: q.currentVersion });
}

const DraftBody = z.object({
  jobDescription: z.string().trim().min(40, "Paste at least a few lines of the job description.").max(12_000),
  categories: z.array(z.nativeEnum(QuestionCategory)).min(1, "Pick at least one category."),
  count: z.number().int().min(1).max(8).default(5),
  level: z.enum(LEVELS).nullable().default(null),
});

export async function draftQuestionsHandler(ctx: HiringCtx, req: NextRequest) {
  // Per person and per workspace, so one company can't run up the bill.
  const limits = [checkRateLimit({ key: `qdraft:${ctx.actorId}`, limit: 12, windowMs: 60 * 60_000 })];
  if (ctx.organizationId) limits.push(checkRateLimit({ key: `qdraft-org:${ctx.organizationId}`, limit: 30, windowMs: 24 * 60 * 60_000 }));
  if (limits.some((l) => !l.ok)) return json({ error: "Drafting limit reached. Try again later." }, 429);

  const parsed = DraftBody.safeParse(await body(req));
  if (!parsed.success) return json({ error: firstIssue(parsed.error, "Invalid request") }, 400);

  let result;
  try {
    result = await generateDrafts(parsed.data);
  } catch (e) {
    console.error("[questions/draft] model call failed:", e instanceof Error ? e.message : e);
    return json({ error: "Couldn't reach the model. Try again in a minute." }, 502);
  }
  if (result.drafts.length === 0) {
    return json({ error: "The model's reply couldn't be used. Try again, or shorten the job description.", rejected: result.rejected }, 422);
  }
  const ids: string[] = [];
  for (const draft of result.drafts) {
    const q = await createQuestion(draft, { createdById: ctx.actorId, source: QuestionSource.AI_DRAFT, organizationId: ctx.organizationId });
    ids.push(q.id);
  }
  await audit(ctx, "QUESTIONS_DRAFTED", "question", ids[0]!, {
    ids,
    model: DRAFT_MODEL,
    rejected: result.rejected.length,
    costUsd: result.costUsd,
    stopReason: result.stopReason,
  });
  return json({ ids, rejected: result.rejected, costUsd: result.costUsd }, 201);
}

// ── Loops ───────────────────────────────────────────────────────────────────

const CreateLoop = z.union([
  z.object({ name: z.string().trim().min(2, "Name the loop.").max(120) }),
  /** Start from a published inturview template. */
  z.object({ fromTemplateId: z.string().min(1) }),
]);

export async function createLoopHandler(ctx: HiringCtx, req: NextRequest) {
  const parsed = CreateLoop.safeParse(await body(req));
  if (!parsed.success) return json({ error: firstIssue(parsed.error, "Invalid loop") }, 400);
  if ("name" in parsed.data) {
    const loop = await prisma.loopTemplate.create({ data: { name: parsed.data.name, createdById: ctx.actorId, organizationId: ctx.organizationId } });
    await audit(ctx, "LOOP_CREATED", "loop", loop.id, { name: loop.name });
    return json({ id: loop.id }, 201);
  }
  if (!ctx.organizationId) return json({ error: "Templates are copied into a workspace." }, 400);
  const template = await prisma.loopTemplate.findFirst({
    where: { id: parsed.data.fromTemplateId, organizationId: null, status: LoopStatus.PUBLISHED },
    select: { id: true, name: true, description: true, roleTarget: true, level: true, currentVersion: true, versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } } },
  });
  if (!template) return notFound("Template");
  // Copy what was published, not the operators' work in progress.
  const rounds = publishedRounds(template.versions[0]?.snapshot);
  const loop = await prisma.loopTemplate.create({
    data: {
      name: template.name,
      description: template.description,
      roleTarget: template.roleTarget,
      level: template.level,
      rounds: rounds as unknown as Prisma.InputJsonValue,
      createdById: ctx.actorId,
      organizationId: ctx.organizationId,
    },
  });
  await audit(ctx, "LOOP_CREATED", "loop", loop.id, { name: loop.name, fromTemplateId: template.id, templateVersion: template.currentVersion });
  return json({ id: loop.id }, 201);
}

/** The revision the editor loaded; saves and status changes must match it. */
const Revision = z.number().int().min(0);
const changed = (e: LoopChangedError) => json({ error: e.message, conflict: true, revision: e.revision }, 409);

export async function updateLoopHandler(ctx: HiringCtx, req: NextRequest, id: string) {
  const parsed = LoopEditSchema.extend({ revision: Revision }).safeParse(await body(req));
  if (!parsed.success) return json({ error: firstIssue(parsed.error, "Invalid loop") }, 400);
  const { rounds, revision, ...meta } = parsed.data;
  // Conditional on the revision: a save from a stale tab can't overwrite a newer one.
  const r = await prisma.loopTemplate.updateMany({
    where: { id, organizationId: ctx.organizationId, revision },
    data: { ...meta, rounds: rounds as unknown as Prisma.InputJsonValue, revision: { increment: 1 } },
  });
  if (r.count === 0) {
    const current = await prisma.loopTemplate.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { revision: true } });
    return current ? changed(new LoopChangedError(current.revision)) : notFound("Loop");
  }
  await audit(ctx, "LOOP_UPDATED", "loop", id, { rounds: rounds.length, revision: revision + 1 });
  // Tell the editor right away what still blocks publishing.
  return json({ ok: true, revision: revision + 1, ...(await checkReadiness(rounds, ctx.organizationId)) });
}

const LoopAction = z.object({ action: z.enum(["publish", "archive", "restore"]), revision: Revision });

export async function loopStatusHandler(ctx: HiringCtx, req: NextRequest, id: string) {
  const parsed = LoopAction.safeParse(await body(req));
  if (!parsed.success) return json({ error: "Unknown action" }, 400);
  if (!(await ownLoop(ctx, id))) return notFound("Loop");
  const { action, revision } = parsed.data;
  try {
    if (action === "publish") {
      const loop = await publishLoop(id, ctx.actorId, revision);
      await audit(ctx, "LOOP_PUBLISHED", "loop", id, { version: loop.currentVersion });
      return json({ status: loop.status, version: loop.currentVersion, revision: loop.revision });
    }
    const archived = action === "archive";
    const loop = await setLoopArchived(id, archived, revision);
    await audit(ctx, archived ? "LOOP_ARCHIVED" : "LOOP_RESTORED", "loop", id);
    return json({ status: loop.status, version: loop.currentVersion, revision: loop.revision });
  } catch (e) {
    if (e instanceof LoopChangedError) return changed(e);
    if (e instanceof LoopNotReadyError) return json({ error: e.message, problems: e.problems }, 409);
    if (e instanceof LoopTransitionError) return json({ error: e.message }, 409);
    if ((e as { code?: string }).code === "P2002") return json({ error: "Already published. Refresh to see the latest version." }, 409);
    throw e;
  }
}

const PREVIEW_DAYS = 3;

/**
 * Try the loop as a candidate. Freezes the current draft exactly as publishing
 * would, into a hidden batch with one invite for the person asking. Nothing is
 * emailed and it never shows up with real candidates.
 */
export async function previewLoopHandler(ctx: HiringCtx, req: NextRequest, id: string) {
  const parsed = z.object({ revision: Revision }).safeParse(await body(req));
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  const loop = await prisma.loopTemplate.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!loop) return notFound("Loop");
  if (loop.revision !== parsed.data.revision) return changed(new LoopChangedError(loop.revision));
  let snapshot;
  try {
    snapshot = (await prisma.$transaction((tx) => freezeLoop(tx, loop))).snapshot;
  } catch (e) {
    if (e instanceof LoopNotReadyError) return json({ error: `Fix this before previewing: ${e.message}`, problems: e.problems }, 409);
    throw e;
  }
  const me = await prisma.user.findUniqueOrThrow({ where: { id: ctx.actorId }, select: { email: true, name: true } });
  const token = newInviteToken();
  const now = new Date();
  await prisma.campaign.create({
    data: {
      organizationId: ctx.organizationId,
      loopTemplateId: loop.id,
      loopVersion: loop.currentVersion,
      name: `Preview · ${loop.name}`,
      preview: true,
      previewSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      previewRevision: loop.revision,
      createdById: ctx.actorId,
      invites: {
        create: { email: me.email, name: me.name, tokenHash: token.hash, status: "SENT", sentAt: now, expiresAt: new Date(now.getTime() + PREVIEW_DAYS * 86_400_000) },
      },
    },
  });
  return json({ link: `/i/${token.raw}` }, 201);
}

const tags = z.array(z.string().trim().toLowerCase().min(1).max(40)).max(10).default([]);
const PoolBody = z.object({ category: z.nativeEnum(QuestionCategory), tags, roles: tags, level: z.enum(LEVELS).nullable().default(null) });

/** How many published questions a pool round would draw from, with a few examples. */
export async function poolPreviewHandler(ctx: HiringCtx, req: NextRequest) {
  const parsed = PoolBody.safeParse(await body(req));
  if (!parsed.success) return json({ error: "Invalid pool" }, 400);
  const where = poolWhere(parsed.data.category, parsed.data, ctx.organizationId);
  const [count, sample] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({ where, take: 4, orderBy: { updatedAt: "desc" }, select: { title: true } }),
  ]);
  return json({ count, sample: sample.map((q) => q.title) });
}

// ── Invites ─────────────────────────────────────────────────────────────────

const CreateCampaign = z.object({
  loopTemplateId: z.string().min(1),
  /** Workspaces invite against a role; the batch name is then made from it. */
  hiringRoleId: z.string().min(1).nullable().default(null),
  name: z.string().trim().max(120).default(""),
  message: z.string().trim().max(2000).nullable().default(null),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null)
    .refine((d) => !d || new Date(`${d}T23:59:59Z`) > new Date(), "The deadline must be in the future."),
  recipients: RecipientsSchema,
});

export async function createCampaignHandler(ctx: HiringCtx, req: NextRequest) {
  const parsed = CreateCampaign.safeParse(await body(req));
  if (!parsed.success) return json({ error: firstIssue(parsed.error, "Invalid campaign") }, 400);
  const d = parsed.data;
  const loop = await prisma.loopTemplate.findFirst({
    where: { id: d.loopTemplateId, organizationId: ctx.organizationId },
    select: { status: true, currentVersion: true },
  });
  if (!loop) return notFound("Loop");
  if (loop.status !== LoopStatus.PUBLISHED || loop.currentVersion === 0) {
    return json({ error: "Publish the loop before inviting candidates." }, 409);
  }
  // Roles only exist in workspaces; the platform library has none.
  const role =
    d.hiringRoleId && ctx.organizationId
      ? await prisma.hiringRole.findFirst({ where: { id: d.hiringRoleId, organizationId: ctx.organizationId }, select: { id: true, title: true, status: true } })
      : null;
  if (d.hiringRoleId && !role) return notFound("Role");
  if (role && role.status !== "OPEN") return json({ error: "This role isn't open. Reopen it to invite candidates." }, 409);
  const name = d.name || (role ? `${role.title} · ${new Date().toISOString().slice(0, 10)}` : "");
  if (name.length < 2) return json({ error: "Name the campaign." }, 400);
  // Someone already invited for this role (and not cancelled) isn't invited again.
  let recipients = d.recipients;
  let alreadyInvited = 0;
  if (role) {
    const existing = new Set(
      (await prisma.invite.findMany({
        where: { campaign: { hiringRoleId: role.id }, status: { not: "REVOKED" }, email: { in: recipients.map((r) => r.email.toLowerCase()) } },
        select: { email: true },
      })).map((i) => i.email),
    );
    recipients = recipients.filter((r) => !existing.has(r.email.toLowerCase()));
    alreadyInvited = d.recipients.length - recipients.length;
    if (recipients.length === 0) return json({ error: "Everyone on this list has already been invited for this role." }, 409);
  }
  const campaign = await prisma.campaign.create({
    data: {
      organizationId: ctx.organizationId,
      hiringRoleId: role?.id ?? null,
      loopTemplateId: d.loopTemplateId,
      loopVersion: loop.currentVersion,
      name,
      message: d.message,
      deadline: d.deadline ? new Date(`${d.deadline}T23:59:59Z`) : null,
      createdById: ctx.actorId,
    },
  });
  const { added, skipped } = await addRecipients(campaign.id, recipients);
  await audit(ctx, "CAMPAIGN_CREATED", "campaign", campaign.id, { loopVersion: loop.currentVersion, added, hiringRoleId: role?.id ?? null });
  return json({ id: campaign.id, added, skipped: skipped + alreadyInvited, alreadyInvited }, 201);
}

// ── Roles ───────────────────────────────────────────────────────────────────

const RoleBody = z.object({
  title: z.string().trim().min(2, "Name the role.").max(120),
  seniority: z.string().trim().max(40).nullable().default(null).transform((v) => v || null),
  location: z.string().trim().max(80).nullable().default(null).transform((v) => v || null),
  context: z.string().trim().max(6000).nullable().default(null).transform((v) => v || null),
  loopTemplateId: z.string().min(1).nullable().default(null),
});

async function ownLoopOrNull(ctx: HiringCtx, loopTemplateId: string | null) {
  if (!loopTemplateId) return true;
  return (await ownLoop(ctx, loopTemplateId)) > 0;
}

export async function createRoleHandler(ctx: HiringCtx, req: NextRequest) {
  if (!ctx.organizationId) return json({ error: "Roles belong to a workspace." }, 400);
  const parsed = RoleBody.safeParse(await body(req));
  if (!parsed.success) return json({ error: firstIssue(parsed.error, "Invalid role") }, 400);
  if (!(await ownLoopOrNull(ctx, parsed.data.loopTemplateId))) return notFound("Loop");
  const role = await prisma.hiringRole.create({ data: { ...parsed.data, organizationId: ctx.organizationId, createdById: ctx.actorId } });
  await audit(ctx, "ROLE_CREATED", "role", role.id, { title: role.title });
  return json({ id: role.id }, 201);
}

export async function updateRoleHandler(ctx: HiringCtx, req: NextRequest, id: string) {
  if (!ctx.organizationId) return notFound("Role");
  const parsed = RoleBody.partial().extend({ status: z.enum(["OPEN", "PAUSED", "CLOSED"]).optional() }).safeParse(await body(req));
  if (!parsed.success) return json({ error: firstIssue(parsed.error, "Invalid role") }, 400);
  if (parsed.data.loopTemplateId !== undefined && !(await ownLoopOrNull(ctx, parsed.data.loopTemplateId))) return notFound("Loop");
  const r = await prisma.hiringRole.updateMany({ where: { id, organizationId: ctx.organizationId }, data: parsed.data });
  if (!r.count) return notFound("Role");
  await audit(ctx, "ROLE_UPDATED", "role", id, { fields: Object.keys(parsed.data) });
  return json({ ok: true });
}

export async function addRecipientsHandler(ctx: HiringCtx, req: NextRequest, id: string) {
  const parsed = z.object({ recipients: RecipientsSchema }).safeParse(await body(req));
  if (!parsed.success) return json({ error: firstIssue(parsed.error, "Invalid list") }, 400);
  if (!(await ownCampaign(ctx, id))) return notFound("Campaign");
  const result = await addRecipients(id, parsed.data.recipients);
  await audit(ctx, "CAMPAIGN_RECIPIENTS_ADDED", "campaign", id, result);
  return json(result);
}

/**
 * Queues the campaign's unsent invites and sends one batch now. The screen keeps
 * calling while `remaining` is above zero; the scheduled worker finishes anything
 * left (retries after a failure, or a closed tab).
 */
export async function sendBatchHandler(ctx: HiringCtx, req: NextRequest, id: string) {
  const parsed = z.object({ retryFailed: z.boolean().default(false) }).safeParse((await body(req)) ?? {});
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  if (!(await ownCampaign(ctx, id))) return notFound("Campaign");
  try {
    await queueCampaign(id, { retryFailed: parsed.data.retryFailed });
    const result = { ...(await processDeliveries({ campaignId: id, limit: 50 })), remaining: await remainingFor(id) };
    if (result.sent || result.failed) await audit(ctx, "INVITES_SENT", "campaign", id, result);
    return json(result);
  } catch (e) {
    console.error("[campaigns/send]", e instanceof Error ? e.message : e);
    return json({ error: "Sending failed. Nothing was lost; try again." }, 502);
  }
}

export async function inviteActionHandler(ctx: HiringCtx, req: NextRequest, id: string) {
  const parsed = z.object({ action: z.enum(["resend", "revoke"]) }).safeParse(await body(req));
  if (!parsed.success) return json({ error: "Unknown action" }, 400);
  if (!(await prisma.invite.count({ where: { id, campaign: { organizationId: ctx.organizationId } } }))) return notFound("Invite");
  try {
    if (parsed.data.action === "revoke") {
      await revokeInvite(id);
      await audit(ctx, "INVITE_REVOKED", "invite", id);
      return json({ ok: true });
    }
    const { sent, error } = await resendInvite(id);
    await audit(ctx, "INVITE_RESENT", "invite", id, { sent });
    return sent ? json({ ok: true }) : json({ error: error ?? "The email didn't go through. Check the address and try again." }, 502);
  } catch (e) {
    if (e instanceof InviteActionError) return json({ error: e.message }, 409);
    throw e;
  }
}

/** Re-runs grading for a round whose scoring failed or needs another look. */
export async function rescoreHandler(ctx: HiringCtx, id: string) {
  const rr = await prisma.loopRoundRun.findFirst({
    where: { id, run: { invite: { campaign: { organizationId: ctx.organizationId } } } },
    select: { status: true },
  });
  if (!rr) return notFound("Round");
  if (rr.status === "IN_PROGRESS") return json({ error: "The candidate hasn't finished this round yet." }, 409);
  const updated = await rescoreRound(id);
  await audit(ctx, "ROUND_RESCORED", "invite", id, { status: updated.status });
  return updated.status === "COMPLETED"
    ? json({ ok: true, score: updated.score })
    : json({ ok: true, pending: true, message: "Grading didn't finish yet. It retries automatically in the background." }, 202);
}
