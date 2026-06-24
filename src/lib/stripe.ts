import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripe;
}

export type PaidPlan = "MONTHLY" | "LIFETIME";

export const PRICE_ENV_BY_PLAN: Record<PaidPlan, string | undefined> = {
  MONTHLY: process.env.STRIPE_PRICE_MONTHLY,
  LIFETIME: process.env.STRIPE_PRICE_LIFETIME,
};

export function planFromPriceId(priceId: string | null | undefined): PaidPlan | null {
  if (priceId === PRICE_ENV_BY_PLAN.MONTHLY) return "MONTHLY";
  if (priceId === PRICE_ENV_BY_PLAN.LIFETIME) return "LIFETIME";
  return null;
}