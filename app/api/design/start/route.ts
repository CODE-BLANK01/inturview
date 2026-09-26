import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDesignProblem } from "@/lib/designProblems";
import { getEffectivePlan, startOfMonthUTC } from "@/lib/plans";
import { captureProductEvent } from "@/lib/analytics";
import { acquireSessionStartLock } from "@/lib/sessionStartLock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ problem_id: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 }
    );
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, planExpiresAt: true, emailVerifiedAt: true, onboardingCompletedAt: true },
  });
  if (!profile) return Response.json({ error: "Account not found" }, { status: 404 });
  if (!profile.emailVerifiedAt) {
    return Response.json(
      { error: "Verify your email first.", redirect: "/verify-email" },
      { status: 403 }
    );
  }
  if (!profile.onboardingCompletedAt) {
    return Response.json(
      { error: "Finish onboarding first.", redirect: "/onboarding" },
      { status: 403 }
    );
  }

  const plan = getEffectivePlan(profile.plan, user.email, profile.planExpiresAt);

  // Backfill: make sure the problem row exists (seed may be missing on fresh DB).
  const row = await prisma.systemDesignProblem.findUnique({ where: { id: parsed.problem_id } });
  if (!row) {
    const p = getDesignProblem(parsed.problem_id);
    if (!p) return Response.json({ error: "Unknown problem" }, { status: 404 });
    await prisma.systemDesignProblem.create({
      data: {
        id: p.id,
        title: p.title,
        difficulty: p.difficulty,
        topic: p.topic,
        prompt: p.prompt,
        expectedRequirements: p.expectedRequirements,
        referenceArchitecture: p.referenceArchitecture,
        deepDiveTopics: p.deepDiveTopics,
        estimatedDurationMinutes: p.estimatedDurationMinutes,
      },
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    await acquireSessionStartLock(tx, user.id, "system-design");

    const existing = await tx.designSession.findFirst({
      where: { userId: user.id, problemId: parsed.problem_id, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true },
    });
    if (existing) return { outcome: "resumed" as const, session: existing };

    if (plan.designSessionsPerMonth !== null) {
      const used = await tx.designSession.count({
        where: { userId: user.id, startedAt: { gte: startOfMonthUTC() } },
      });
      if (used >= plan.designSessionsPerMonth) {
        return { outcome: "limited" as const, used };
      }
    }

    const session = await tx.designSession.create({
      data: { userId: user.id, problemId: parsed.problem_id },
      select: { id: true, startedAt: true },
    });
    return { outcome: "created" as const, session };
  });

  if (result.outcome === "limited") {
    return Response.json(
      {
        error: `You've used all ${plan.designSessionsPerMonth} system-design sessions on the ${plan.name} plan this month. Resets on the 1st.`,
        code: "PLAN_LIMIT_REACHED",
        plan: plan.tier,
        used: result.used,
        limit: plan.designSessionsPerMonth,
      },
      { status: 403 }
    );
  }
  if (result.outcome === "resumed") {
    return Response.json({ ...result.session, resumed: true }, { status: 200 });
  }

  await captureProductEvent(user.id, {
    event: "interview_started",
    properties: { mode: "system_design", session_id: result.session.id },
  });

  return Response.json({ ...result.session, resumed: false }, { status: 201 });
}
