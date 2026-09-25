import { NextRequest } from "next/server";
import { z } from "zod";
import { OnboardingGoal } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getEffectivePlan, startOfMonthUTC } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const monthStart = startOfMonthUTC();
  const [
    profile,
    interviewsThisMonth,
    designSessionsThisMonth,
    behavioralSessionsThisMonth,
    recruiterSessionsThisMonth,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        planExpiresAt: true,
        goal: true,
        emailVerifiedAt: true,
        onboardingCompletedAt: true,
        totpEnabledAt: true,
        createdAt: true,
      },
    }),
    prisma.interview.count({
      where: { userId: user.id, startedAt: { gte: monthStart } },
    }),
    prisma.designSession.count({
      where: { userId: user.id, startedAt: { gte: monthStart } },
    }),
    prisma.conversationSession.count({
      where: {
        userId: user.id,
        kind: "BEHAVIORAL",
        startedAt: { gte: monthStart },
      },
    }),
    prisma.conversationSession.count({
      where: {
        userId: user.id,
        kind: "RECRUITER_SCREEN",
        startedAt: { gte: monthStart },
      },
    }),
  ]);
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({
    profile: {
      ...profile,
      emailVerifiedAt: profile.emailVerifiedAt?.toISOString() ?? null,
      onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
      twoFactorEnabled: !!profile.totpEnabledAt,
      createdAt: profile.createdAt.toISOString(),
    },
    usage: {
      interviewsThisMonth,
      designSessionsThisMonth,
      behavioralSessionsThisMonth,
      recruiterSessionsThisMonth,
      plan: getEffectivePlan(profile.plan, profile.email, profile.planExpiresAt),
    },
  });
}

const PatchBody = z
  .object({
    name: z.string().trim().min(1).max(80).nullable().optional(),
    goal: z.enum(["PRACTICING", "EXPLORING"]).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "No fields to update");

export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  let parsed: z.infer<typeof PatchBody>;
  try {
    parsed = PatchBody.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (typeof parsed.name !== "undefined") data.name = parsed.name;
  if (typeof parsed.goal !== "undefined") {
    data.goal = parsed.goal as OnboardingGoal | null;
  }

  await prisma.user.update({ where: { id: user.id }, data });
  return Response.json({ ok: true });
}
