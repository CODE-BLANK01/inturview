import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function getInterviewSprintPriceId(): string {
  const priceId = process.env.STRIPE_INTERVIEW_SPRINT_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_INTERVIEW_SPRINT_PRICE_ID is not configured");
  }
  return priceId;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return secret;
}
