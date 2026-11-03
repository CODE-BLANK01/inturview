import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { defaultDestination } from "@/lib/landing";
import { LAST_PRODUCT_COOKIE, parseProduct } from "@/lib/landingRule";

export const dynamic = "force-dynamic";

/**
 * Signing in with nowhere particular to go lands here, and we send you on:
 * back to the product you used last (Hire or Practice).
 */
export default async function StartPage() {
  const user = await requireUser();
  if (!user) redirect("/signin");
  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true, onboardingCompletedAt: true } });
  if (!profile?.emailVerifiedAt) redirect("/verify-email");
  const last = parseProduct(cookies().get(LAST_PRODUCT_COOKIE)?.value);
  redirect(await defaultDestination(user.id, profile.onboardingCompletedAt, last));
}
