import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectivePlan, type PlanDefinition } from "@/lib/plans";
import { DashboardShell } from "./DashboardShell";

/** Shared navigation for the candidate's catalogs, history, and account. */
export async function PracticeWorkspace({
  children,
  user,
  plan,
}: {
  children: React.ReactNode;
  user: SessionUser;
  plan?: PlanDefinition;
}) {
  let currentPlan = plan;
  if (!currentPlan) {
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, planExpiresAt: true },
    });
    currentPlan = getEffectivePlan(
      profile?.plan ?? "FREE",
      user.email,
      profile?.planExpiresAt,
    );
  }

  return (
    <DashboardShell
      name={user.name}
      email={user.email}
      planName={currentPlan.name}
      paid={currentPlan.tier === "PRO"}
      isAdmin={user.role === "ADMIN"}
    >
      {children}
    </DashboardShell>
  );
}
