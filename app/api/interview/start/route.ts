import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getProblem } from "@/lib/problems";
import { getPlan, startOfMonthUTC } from "@/lib/plans";

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

  // Plan + monthly-cap enforcement. Free tier is capped; paid tiers (when they
  // exist) pass through. Cap is per UTC calendar month.
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      plan: true,
      emailVerifiedAt: true,
      onboardingCompletedAt: true,
    },
  });
  if (!profile) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }
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

  // Resume vs. start fresh. If the user has an existing IN_PROGRESS interview
  // for this problem, hand them that one — clicking "Continue" or re-opening
  // the problem should pick up where they left off, not orphan the old row.
  // Resumes bypass the monthly cap (they don't count as a new attempt).
  const existing = await prisma.interview.findFirst({
    where: {
      userId: user.id,
      problemId: parsed.problem_id,
      status: "IN_PROGRESS",
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  });
  if (existing) {
    return Response.json({ ...existing, resumed: true }, { status: 200 });
  }

  // Fresh interview — enforce monthly plan cap.
  const plan = getPlan(profile.plan);
  if (plan.interviewsPerMonth !== null) {
    const monthStart = startOfMonthUTC();
    const used = await prisma.interview.count({
      where: { userId: user.id, startedAt: { gte: monthStart } },
    });
    if (used >= plan.interviewsPerMonth) {
      return Response.json(
        {
          error: `You've used all ${plan.interviewsPerMonth} interviews on the ${plan.name} plan this month. Resets on the 1st.`,
          code: "PLAN_LIMIT_REACHED",
          plan: plan.tier,
          used,
          limit: plan.interviewsPerMonth,
        },
        { status: 403 }
      );
    }
  }

  // Make sure the problem exists in the DB (seeded). If for some reason it isn't
  // (fresh DB without seeding), fall back to inserting from the static list.
  const problemRow = await prisma.problem.findUnique({ where: { id: parsed.problem_id } });
  if (!problemRow) {
    const p = getProblem(parsed.problem_id);
    if (!p) return Response.json({ error: "Unknown problem" }, { status: 404 });
    await prisma.problem.create({
      data: {
        id: p.id,
        title: p.title,
        difficulty: p.difficulty,
        topic: p.topic,
        leetcodeUrl: p.leetcode_url,
        description: p.description,
        examples: p.examples,
        constraints: p.constraints,
        optimalTime: p.optimal_time,
        optimalSpace: p.optimal_space,
        tags: p.tags,
      },
    });
  }

  const created = await prisma.interview.create({
    data: { userId: user.id, problemId: parsed.problem_id },
    select: { id: true, startedAt: true },
  });

  return Response.json({ ...created, resumed: false }, { status: 201 });
}
