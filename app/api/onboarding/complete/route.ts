import { NextRequest } from "next/server";
import { z } from "zod";
import { OnboardingGoal, PlanTier } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(1).max(80).nullable(),
  goal: z.enum(["PRACTICING", "RECRUITING", "COACHING", "EXPLORING"]),
  // Only FREE is selectable from the UI today. Other tiers are accepted here so
  // the schema is forward-compatible, but we keep selectability gated on the
  // client until billing is wired up.
  plan: z.enum(["FREE", "PRO", "TEAM_STARTER", "TEAM_GROWTH", "ENTERPRISE"]).default("FREE"),
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

  // Reject any non-FREE plan until billing exists. Defensive — also enforced
  // on the client.
  if (parsed.plan !== "FREE") {
    return Response.json(
      { error: "That plan isn't available yet. Defaulting to Free." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.name,
      goal: parsed.goal as OnboardingGoal,
      plan: PlanTier.FREE,
      onboardingCompletedAt: new Date(),
    },
  });

  return Response.json({ ok: true });
}
