import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { captureProductEvent } from "@/lib/analytics";
import { INTERVIEW_SPRINT } from "@/lib/billing";
import { getInterviewSprintPriceId, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      name: true,
      emailVerifiedAt: true,
      onboardingCompletedAt: true,
      stripeCustomerId: true,
    },
  });
  if (!profile) return Response.json({ error: "Account not found" }, { status: 404 });
  if (!profile.emailVerifiedAt) {
    return Response.json(
      { error: "Verify your email before purchasing.", redirect: "/verify-email" },
      { status: 403 }
    );
  }
  if (!profile.onboardingCompletedAt) {
    return Response.json(
      { error: "Finish onboarding before purchasing.", redirect: "/onboarding" },
      { status: 403 }
    );
  }

  try {
    const stripe = getStripe();
    const priceId = getInterviewSprintPriceId();
    const price = await stripe.prices.retrieve(priceId);
    if (
      !price.active ||
      price.type !== "one_time" ||
      price.unit_amount !== INTERVIEW_SPRINT.amountCents ||
      price.currency.toLowerCase() !== INTERVIEW_SPRINT.currency
    ) {
      throw new Error(
        "The configured Stripe Price must be an active one-time USD $19.00 price"
      );
    }
    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        name: profile.name ?? undefined,
        metadata: { user_id: user.id },
      });
      const claimed = await prisma.user.updateMany({
        where: { id: user.id, stripeCustomerId: null },
        data: { stripeCustomerId: customer.id },
      });
      customerId =
        claimed.count === 1
          ? customer.id
          : (
              await prisma.user.findUnique({
                where: { id: user.id },
                select: { stripeCustomerId: true },
              })
            )?.stripeCustomerId ?? customer.id;
    }

    // Use the request origin so a stale NEXTAUTH_URL can never send a
    // production checkout back to localhost.
    const origin = req.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/account?checkout=canceled`,
      metadata: {
        product: INTERVIEW_SPRINT.product,
        user_id: user.id,
        access_days: String(INTERVIEW_SPRINT.accessDays),
      },
      payment_intent_data: {
        metadata: {
          product: INTERVIEW_SPRINT.product,
          user_id: user.id,
        },
      },
    });

    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    await captureProductEvent(user.id, {
      event: "checkout_started",
      properties: {
        product: INTERVIEW_SPRINT.product,
        amount_cents: INTERVIEW_SPRINT.amountCents,
      },
    });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error(
      "[billing/checkout] failed:",
      error instanceof Error ? error.message : error
    );
    return Response.json(
      { error: "Checkout is temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
}
