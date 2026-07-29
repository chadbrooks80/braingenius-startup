import "server-only";

export type BillingPriceConfiguration = {
  monthly: string | null | undefined;
  lifetime: string | null | undefined;
};

export type EntitlementSubscription = {
  tier: string | null;
  trialEndsAt: Date | null;
  stripePriceId: string | null;
  stripeStatus: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export type EntitlementGrantSource =
  | "administrative"
  | "free_trial"
  | "lifetime"
  | "monthly";

export type EntitlementDenialReason =
  | "missing_subscription"
  | "unsupported_tier"
  | "trial_expired"
  | "price_mismatch"
  | "status_not_allowed"
  | "period_expired";

export type EntitlementResult =
  | { granted: true; source: EntitlementGrantSource }
  | { granted: false; reason: EntitlementDenialReason };

type EvaluateEntitlementInput = {
  subscription: EntitlementSubscription | null | undefined;
  prices: BillingPriceConfiguration;
  now?: Date;
};

const MONTHLY_ALLOWED_STATUSES = new Set(["active", "trialing"]);

function isStrictlyAfter(value: Date | null, boundary: Date): boolean {
  return value !== null && Number.isFinite(value.getTime()) && value.getTime() > boundary.getTime();
}

export function evaluateSubscriptionEntitlement({
  subscription,
  prices,
  now = new Date(),
}: EvaluateEntitlementInput): EntitlementResult {
  if (!subscription) {
    return { granted: false, reason: "missing_subscription" };
  }

  switch (subscription.tier) {
    case "ADMIN":
      return { granted: true, source: "administrative" };

    case "FREE_TRIAL":
      return isStrictlyAfter(subscription.trialEndsAt, now)
        ? { granted: true, source: "free_trial" }
        : { granted: false, reason: "trial_expired" };

    case "LIFETIME":
      if (!prices.lifetime || subscription.stripePriceId !== prices.lifetime) {
        return { granted: false, reason: "price_mismatch" };
      }
      return subscription.stripeStatus === "paid"
        ? { granted: true, source: "lifetime" }
        : { granted: false, reason: "status_not_allowed" };

    case "MONTHLY":
      if (!prices.monthly || subscription.stripePriceId !== prices.monthly) {
        return { granted: false, reason: "price_mismatch" };
      }
      if (
        !subscription.stripeStatus ||
        !MONTHLY_ALLOWED_STATUSES.has(subscription.stripeStatus)
      ) {
        return { granted: false, reason: "status_not_allowed" };
      }
      return isStrictlyAfter(subscription.currentPeriodEnd, now)
        ? { granted: true, source: "monthly" }
        : { granted: false, reason: "period_expired" };

    default:
      return { granted: false, reason: "unsupported_tier" };
  }
}
