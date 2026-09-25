import { Prisma, PlanTier } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { captureProductEvent } from "@/lib/analytics";
import { addAccessDays, INTERVIEW_SPRINT, nextAccessWindow } from "@/lib/billing";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GrantResult =
  | { granted: false }
  | { granted: true; userId: string; wasExtension: boolean };

function stripeId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function grantSprint(
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<GrantResult> {
  const userId = session.metadata?.user_id ?? session.client_reference_id;
  const accessDays = Number(session.metadata?.access_days);
  const valid =
    session.mode === "payment" &&
    session.payment_status === "paid" &&
    session.metadata?.product === INTERVIEW_SPRINT.product &&
    userId &&
    accessDays === INTERVIEW_SPRINT.accessDays &&
    session.amount_total === INTERVIEW_SPRINT.amountCents &&
    session.currency?.toLowerCase() === INTERVIEW_SPRINT.currency;
  if (!valid) throw new Error(`Rejected invalid Checkout session ${session.id}`);

  return prisma.$transaction(
    async (tx) => {
      const processed = await tx.stripeWebhookEvent.findUnique({
        where: { id: event.id },
        select: { id: true },
      });
      if (processed) return { granted: false } as const;

      const existing = await tx.billingPurchase.findUnique({
        where: { stripeCheckoutSessionId: session.id },
        select: { id: true },
      });
      if (existing) {
        await tx.stripeWebhookEvent.create({
          data: { id: event.id, type: event.type },
        });
        return { granted: false } as const;
      }

      const account = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, planExpiresAt: true },
      });
      if (!account) throw new Error(`Checkout user ${userId} was not found`);

      const now = new Date();
      const window = nextAccessWindow(account.planExpiresAt, now, accessDays);
      const customerId = stripeId(session.customer);
      await tx.billingPurchase.create({
        data: {
          userId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: stripeId(session.payment_intent),
          stripeCustomerId: customerId,
          amountCents: session.amount_total!,
          currency: session.currency!.toLowerCase(),
          accessDays,
          accessStartsAt: window.startsAt,
          accessEndsAt: window.endsAt,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          plan: PlanTier.PRO,
          planExpiresAt: window.endsAt,
          ...(customerId ? { stripeCustomerId: customerId } : {}),
        },
      });
      await tx.stripeWebhookEvent.create({
        data: { id: event.id, type: event.type },
      });
      return { granted: true, userId, wasExtension: window.wasExtension } as const;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

async function recordIgnoredEvent(event: Stripe.Event): Promise<void> {
  await prisma.stripeWebhookEvent.upsert({
    where: { id: event.id },
    create: { id: event.id, type: event.type },
    update: {},
  });
}

async function refundSprint(
  event: Stripe.Event,
  charge: Stripe.Charge
): Promise<void> {
  // Partial refunds do not change access. A later full-refund event can still
  // revoke the grant because it has a different Stripe event ID.
  if (!charge.refunded || charge.amount_refunded < charge.amount) {
    await recordIgnoredEvent(event);
    return;
  }

  const paymentIntentId = stripeId(charge.payment_intent);
  if (!paymentIntentId) {
    await recordIgnoredEvent(event);
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      const processed = await tx.stripeWebhookEvent.findUnique({
        where: { id: event.id },
        select: { id: true },
      });
      if (processed) return;

      const purchase = await tx.billingPurchase.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
        select: { id: true, userId: true, accessDays: true, status: true },
      });
      if (!purchase || purchase.status === "REFUNDED") {
        await tx.stripeWebhookEvent.create({
          data: { id: event.id, type: event.type },
        });
        return;
      }

      const account = await tx.user.findUnique({
        where: { id: purchase.userId },
        select: { planExpiresAt: true },
      });
      const now = new Date();
      const reducedExpiry = account?.planExpiresAt
        ? addAccessDays(account.planExpiresAt, -purchase.accessDays)
        : null;
      const remainsActive = Boolean(reducedExpiry && reducedExpiry > now);

      await tx.billingPurchase.update({
        where: { id: purchase.id },
        data: { status: "REFUNDED", refundedAt: now },
      });
      if (account) {
        await tx.user.update({
          where: { id: purchase.userId },
          data: {
            plan: remainsActive ? PlanTier.PRO : PlanTier.FREE,
            planExpiresAt: remainsActive ? reducedExpiry : null,
          },
        });
      }
      await tx.stripeWebhookEvent.create({
        data: { id: event.id, type: event.type },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      getStripeWebhookSecret()
    );
  } catch (error) {
    console.error(
      "[billing/webhook] signature failed:",
      error instanceof Error ? error.message : error
    );
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      if (session.metadata?.product !== INTERVIEW_SPRINT.product) {
        await recordIgnoredEvent(event);
        return Response.json({ received: true });
      }
      if (session.payment_status !== "paid") {
        await recordIgnoredEvent(event);
        return Response.json({ received: true });
      }
      const result = await grantSprint(event, session);
      if (result.granted) {
        await captureProductEvent(result.userId, {
          event: "purchase_completed",
          properties: {
            product: INTERVIEW_SPRINT.product,
            amount_cents: INTERVIEW_SPRINT.amountCents,
            currency: INTERVIEW_SPRINT.currency,
            access_days: INTERVIEW_SPRINT.accessDays,
            was_extension: result.wasExtension,
          },
        });
      }
    } else if (event.type === "charge.refunded") {
      await refundSprint(event, event.data.object);
    } else {
      await recordIgnoredEvent(event);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error(
      `[billing/webhook] ${event.type} failed:`,
      error instanceof Error ? error.message : error
    );
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
