// The hiring team's view of candidates: one row per invite, with its stage.
import { prisma } from "../db";
import { publishedRounds } from "../loopTemplates";
import { attentionReason, stageOf, type Stage } from "../candidateStage";

export interface CandidateRow {
  id: string;
  name: string | null;
  email: string;
  role: { id: string; title: string } | null;
  stage: Stage;
  attention: string | null;
  score: number | null;
  coverage: { assessed: number; total: number } | null;
  inviteStatus: string;
  lastActivity: Date;
  /** The applicant's data was deleted (retention or a request). */
  redacted: boolean;
}

/**
 * Candidates in a workspace, newest activity first. Scoped by organizationId on
 * every row; `assignedTo` limits it to one reviewer's assignments.
 */
export async function listCandidates(organizationId: string, opts: { roleId?: string; assignedTo?: string } = {}): Promise<CandidateRow[]> {
  const invites = await prisma.invite.findMany({
    where: {
      // Previews are a teammate trying the loop, not a candidate.
      campaign: { organizationId, preview: false, ...(opts.roleId && { hiringRoleId: opts.roleId }) },
      ...(opts.assignedTo && { assignments: { some: { userId: opts.assignedTo } } }),
    },
    // Every candidate: counts and stage tabs must cover all of them. Rows are small;
    // the page renders a slice (see CandidatesView).
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      updatedAt: true,
      lastActivityAt: true,
      redactedAt: true,
      decision: true,
      campaign: { select: { loopTemplateId: true, loopVersion: true, hiringRole: { select: { id: true, title: true } } } },
      run: { select: { overallScore: true, assessedQuestions: true, totalQuestions: true, rounds: { select: { status: true } } } },
    },
  });
  // Round counts per published version, looked up once.
  const keys = [...new Set(invites.map((i) => `${i.campaign.loopTemplateId}:${i.campaign.loopVersion}`))];
  const versions = keys.length
    ? await prisma.loopTemplateVersion.findMany({
        where: { OR: keys.map((k) => ({ loopTemplateId: k.split(":")[0]!, version: Number(k.split(":")[1]) })) },
        select: { loopTemplateId: true, version: true, snapshot: true },
      })
    : [];
  const roundCount = new Map(versions.map((v) => [`${v.loopTemplateId}:${v.version}`, publishedRounds(v.snapshot).length]));

  return invites.map((i) => {
    const rounds = i.run?.rounds ?? [];
    const total = roundCount.get(`${i.campaign.loopTemplateId}:${i.campaign.loopVersion}`) ?? 0;
    return {
      id: i.id,
      name: i.name,
      email: i.email,
      role: i.campaign.hiringRole,
      stage: stageOf(i.status, rounds, total, i.decision),
      attention: attentionReason(i.status, rounds),
      score: i.run?.overallScore ?? null,
      coverage: i.run?.totalQuestions ? { assessed: i.run.assessedQuestions ?? 0, total: i.run.totalQuestions } : null,
      inviteStatus: i.status,
      lastActivity: i.lastActivityAt ?? i.updatedAt,
      redacted: !!i.redactedAt,
    };
  }).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
}
