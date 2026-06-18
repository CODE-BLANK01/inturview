import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getPlan, startOfMonthUTC } from "@/lib/plans";
import { getBehavioralScenario } from "@/lib/behavioralScenarios";
import { ConversationKind } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.enum(["BEHAVIORAL", "RECRUITER_SCREEN"]),
  scenario_id: z.string().min(1).optional(),
});

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
    select: { plan: true, emailVerifiedAt: true, onboardingCompletedAt: true },
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

  // Behavioral requires a scenario_id; recruiter screen never has one.
  if (parsed.kind === "BEHAVIORAL" && !parsed.scenario_id) {
    return Response.json({ error: "scenario_id required" }, { status: 400 });
  }
  if (parsed.kind === "RECRUITER_SCREEN" && parsed.scenario_id) {
    return Response.json(
      { error: "Recruiter screen does not take a scenario" },
      { status: 400 }
    );
  }

  // Resume IN_PROGRESS if one exists for this (user, kind, scenario).
  const existing = await prisma.conversationSession.findFirst({
    where: {
      userId: user.id,
      kind: parsed.kind as ConversationKind,
      scenarioId: parsed.scenario_id ?? null,
      status: "IN_PROGRESS",
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  });
  if (existing) {
    return Response.json({ ...existing, resumed: true }, { status: 200 });
  }

  // Fresh — enforce the right monthly cap.
  const plan = getPlan(profile.plan);
  const cap =
    parsed.kind === "BEHAVIORAL"
      ? plan.behavioralSessionsPerMonth
      : plan.recruiterSessionsPerMonth;
  if (cap !== null) {
    const monthStart = startOfMonthUTC();
    const used = await prisma.conversationSession.count({
      where: {
        userId: user.id,
        kind: parsed.kind as ConversationKind,
        startedAt: { gte: monthStart },
      },
    });
    if (used >= cap) {
      const label =
        parsed.kind === "BEHAVIORAL" ? "behavioral sessions" : "recruiter screens";
      return Response.json(
        {
          error: `You've used all ${cap} ${label} on the ${plan.name} plan this month. Resets on the 1st.`,
          code: "PLAN_LIMIT_REACHED",
          plan: plan.tier,
          used,
          limit: cap,
        },
        { status: 403 }
      );
    }
  }

  // For behavioral: backfill the scenario row if seeder hasn't run.
  if (parsed.kind === "BEHAVIORAL" && parsed.scenario_id) {
    const row = await prisma.behavioralScenario.findUnique({
      where: { id: parsed.scenario_id },
    });
    if (!row) {
      const s = getBehavioralScenario(parsed.scenario_id);
      if (!s) return Response.json({ error: "Unknown scenario" }, { status: 404 });
      await prisma.behavioralScenario.create({
        data: {
          id: s.id,
          title: s.title,
          category: s.category,
          prompt: s.prompt,
          expectedSignals: s.expectedSignals,
        },
      });
    }
  }

  const created = await prisma.conversationSession.create({
    data: {
      userId: user.id,
      kind: parsed.kind as ConversationKind,
      scenarioId: parsed.scenario_id ?? null,
    },
    select: { id: true, startedAt: true },
  });

  return Response.json({ ...created, resumed: false }, { status: 201 });
}
