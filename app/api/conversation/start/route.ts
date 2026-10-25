import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getEffectivePlan, startOfMonthUTC } from "@/lib/plans";
import { getBehavioralScenario } from "@/lib/behavioralScenarios";
import { ConversationKind } from "@prisma/client";
import { captureProductEvent } from "@/lib/analytics";
import { acquireSessionStartLock } from "@/lib/sessionStartLock";
import { newVoicePlan, readVoicePlan, voiceDeadlineMs } from "@/lib/voicePlan";
import { voiceEnabledFor } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.enum(["BEHAVIORAL", "RECRUITER_SCREEN"]),
  scenario_id: z.string().min(1).optional(),
  /** Run the session as a spoken interview (OpenAI Realtime). */
  voice: z.boolean().optional(),
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
  if (parsed.voice && !voiceEnabledFor(parsed.kind)) {
    return Response.json({ error: "Voice interviews are turned off" }, { status: 403 });
  }

  const plan = getEffectivePlan(profile.plan, user.email, profile.planExpiresAt);
  const cap =
    parsed.kind === "BEHAVIORAL"
      ? plan.behavioralSessionsPerMonth
      : plan.recruiterSessionsPerMonth;
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

  const result = await prisma.$transaction(async (tx) => {
    const mode = parsed.kind === "BEHAVIORAL" ? "behavioral" : "recruiter-screen";
    await acquireSessionStartLock(tx, user.id, mode);

    const existing = await tx.conversationSession.findFirst({
      where: {
        userId: user.id,
        kind: parsed.kind as ConversationKind,
        scenarioId: parsed.scenario_id ?? null,
        status: "IN_PROGRESS",
      },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true, plan: true },
    });
    if (existing) {
      // Continuing a typed session by voice: start its voice clock now. A
      // voice session that reconnects keeps the clock it already has, unless
      // it ran out without the candidate ever answering: nothing was used, so
      // it gets a fresh clock instead of a dead "time is up" session.
      const voicePlan = readVoicePlan(existing.plan);
      const expiredUnused =
        voicePlan &&
        Date.now() > voiceDeadlineMs(voicePlan) &&
        (await tx.conversationMessage.count({
          where: { sessionId: existing.id, role: "user" },
        })) === 0;
      if (parsed.voice && (!voicePlan || expiredUnused)) {
        await tx.conversationSession.update({
          where: { id: existing.id },
          data: { plan: newVoicePlan(parsed.kind) as unknown as object },
        });
      }
      return {
        outcome: "resumed" as const,
        session: { id: existing.id, startedAt: existing.startedAt },
      };
    }

    if (cap !== null) {
      const used = await tx.conversationSession.count({
        where: {
          userId: user.id,
          kind: parsed.kind as ConversationKind,
          startedAt: { gte: startOfMonthUTC() },
        },
      });
      if (used >= cap) return { outcome: "limited" as const, used };
    }

    const session = await tx.conversationSession.create({
      data: {
        userId: user.id,
        kind: parsed.kind as ConversationKind,
        scenarioId: parsed.scenario_id ?? null,
        ...(parsed.voice ? { plan: newVoicePlan(parsed.kind) as unknown as object } : {}),
      },
      select: { id: true, startedAt: true },
    });
    return { outcome: "created" as const, session };
  });

  if (result.outcome === "limited") {
    const label =
      parsed.kind === "BEHAVIORAL" ? "behavioral sessions" : "recruiter screens";
    return Response.json(
      {
        error: `You've used all ${cap} ${label} on the ${plan.name} plan this month. Resets on the 1st.`,
        code: "PLAN_LIMIT_REACHED",
        plan: plan.tier,
        used: result.used,
        limit: cap,
      },
      { status: 403 }
    );
  }
  if (result.outcome === "resumed") {
    return Response.json({ ...result.session, resumed: true }, { status: 200 });
  }

  await captureProductEvent(user.id, {
    event: "interview_started",
    properties: {
      mode: parsed.kind === "BEHAVIORAL" ? "behavioral" : "recruiter_screen",
      session_id: result.session.id,
    },
  });

  return Response.json({ ...result.session, resumed: false }, { status: 201 });
}
