// Where someone goes when nothing else says where (signing in from the home
// page, finishing email verification). See pickLanding for the rule.
import { prisma } from "./db";
import { pickLanding, type Product } from "./landingRule";

export async function defaultDestination(userId: string, onboardingCompletedAt: Date | null, last: Product | null = null): Promise<string> {
  const memberships = await prisma.organizationMember.count({ where: { userId } });
  return pickLanding({ practiceSetUp: !!onboardingCompletedAt, inWorkspace: memberships > 0, last });
}
