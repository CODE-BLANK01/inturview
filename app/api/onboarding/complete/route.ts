import { NextRequest } from "next/server";
import { z } from "zod";
import { OnboardingGoal } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(1).max(80).nullable(),
  goal: z.enum(["PRACTICING", "EXPLORING"]),
  // Accepted for compatibility with the current client. The user's plan is
  // created as FREE at signup and is never changed by onboarding; billing is
  // the only future authority allowed to grant or revoke paid access.
  plan: z.literal("FREE").default("FREE"),
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

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.name,
      goal: parsed.goal as OnboardingGoal,
      onboardingCompletedAt: new Date(),
    },
  });

  return Response.json({ ok: true });
}
