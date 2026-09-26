import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getEffectivePlan, startOfMonthUTC } from "@/lib/plans";
import {
  buildFaceToFacePlan,
  FACE_TO_FACE_LEVELS,
  FACE_TO_FACE_TRACKS,
  type FaceToFacePlan,
} from "@/lib/faceToFaceQuestions";
import { isRealtimeConfigured, signRealtimeToken } from "@/lib/faceToFaceToken";
import { captureProductEvent } from "@/lib/analytics";
import { FACE_TO_FACE_ENABLED } from "@/lib/features";
import { acquireSessionStartLock } from "@/lib/sessionStartLock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  track: z.enum(FACE_TO_FACE_TRACKS),
  level: z.enum(FACE_TO_FACE_LEVELS),
});

function maxDurationSec(): number {
  const v = Number(process.env.FACE_TO_FACE_MAX_MINUTES ?? "20");
  return (Number.isFinite(v) && v > 0 ? v : 20) * 60;
}

export async function POST(req: NextRequest) {
  if (!FACE_TO_FACE_ENABLED) {
    return Response.json({ error: "Face-to-face interviews are coming soon." }, { status: 404 });
  }

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

  if (!isRealtimeConfigured()) {
    console.error("[face-to-face/start] REALTIME_SERVICE_SECRET missing or under 32 chars");
    return Response.json(
      { error: "Face-to-face interviews aren't configured on this server yet." },
      { status: 500 }
    );
  }

  const planDef = getEffectivePlan(profile.plan, user.email, profile.planExpiresAt);
  const cap = planDef.faceToFaceSessionsPerMonth;
  const result = await prisma.$transaction(async (tx) => {
    await acquireSessionStartLock(tx, user.id, "face-to-face");

    const existing = await tx.conversationSession.findFirst({
      where: { userId: user.id, kind: "FACE_TO_FACE", status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true, plan: true },
    });
    if (existing) {
      const existingPlan = existing.plan as unknown as FaceToFacePlan | null;
      const expired =
        !existingPlan ||
        existing.startedAt.getTime() + existingPlan.maxDurationSec * 1000 < Date.now();
      if (!expired) return { outcome: "resumed" as const, session: existing };

      // A stale or plan-less in-progress row would otherwise be resumed forever.
      await tx.conversationSession.update({
        where: { id: existing.id },
        data: { status: "ABANDONED", completedAt: new Date() },
      });
    }

    if (cap !== null) {
      const used = await tx.conversationSession.count({
        where: {
          userId: user.id,
          kind: "FACE_TO_FACE",
          startedAt: { gte: startOfMonthUTC() },
        },
      });
      if (used >= cap) return { outcome: "limited" as const, used };
    }

    const plan = buildFaceToFacePlan(
      parsed.track,
      parsed.level,
      `${user.id}:${Date.now()}`,
      maxDurationSec()
    );
    const session = await tx.conversationSession.create({
      data: { userId: user.id, kind: "FACE_TO_FACE", plan: plan as unknown as object },
      select: { id: true, startedAt: true },
    });
    return { outcome: "created" as const, session };
  });

  if (result.outcome === "limited") {
    return Response.json(
      {
        error: `You've used all ${cap} face-to-face interviews on the ${planDef.name} plan this month. Resets on the 1st.`,
        code: "PLAN_LIMIT_REACHED",
        plan: planDef.tier,
        used: result.used,
        limit: cap,
      },
      { status: 403 }
    );
  }
  if (result.outcome === "resumed") {
    return Response.json(
      {
        id: result.session.id,
        startedAt: result.session.startedAt,
        resumed: true,
        token: signRealtimeToken(result.session.id, user.id),
      },
      { status: 200 }
    );
  }

  await captureProductEvent(user.id, {
    event: "interview_started",
    properties: { mode: "face_to_face", session_id: result.session.id },
  });

  return Response.json(
    {
      ...result.session,
      resumed: false,
      token: signRealtimeToken(result.session.id, user.id),
    },
    { status: 201 }
  );
}
