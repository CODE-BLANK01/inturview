// Where someone goes when nothing else says where (signing in from the home
// page, finishing email verification). Hiring teammates who never set up
// practice go to their workspace, not practice onboarding.
import { prisma } from "./db";

export async function defaultDestination(userId: string, onboardingCompletedAt: Date | null): Promise<string> {
  if (onboardingCompletedAt) return "/dashboard";
  const memberships = await prisma.organizationMember.count({ where: { userId } });
  return memberships > 0 ? "/hire" : "/onboarding";
}
