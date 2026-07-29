import "server-only";
import type Stripe from "stripe";
import prisma from "@/lib/db";
import { getStripe, PRICE_ENV_BY_PLAN, type PaidPlan } from "@/lib/stripe";
import {
  evaluateSubscriptionEntitlement,
  type BillingPriceConfiguration,
  type EntitlementSubscription,
} from "@/lib/billing/entitlement";

export type CheckoutConfirmationResult =
  | { status: "confirmed"; plan: PaidPlan }
  | { status: "pending" }
  | { status: "rejected" };

export type CheckoutSessionSnapshot = {
  id: string;
  clientReferenceId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  mode: string;
  status: string | null;
  paymentStatus: string;
  lineItems: ReadonlyArray<{ priceId: string | null; quantity: number | null }>;
  lineItemsHaveMore: boolean;
};

export type StripeSubscriptionSnapshot = {
  id: string;
  customerId: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  items: ReadonlyArray<{ priceId: string | null; currentPeriodEnd: Date | null }>;
  itemsHaveMore: boolean;
};

type PersistedSubscriptionState = Omit<
  EntitlementSubscription,
  "tier" | "trialEndsAt"
> & {
  tier: PaidPlan | "CANCELED" | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export type StripeStateProvider = {
  retrieveCheckoutSession(checkoutSessionId: string): Promise<CheckoutSessionSnapshot>;
  retrieveSubscription(stripeSubscriptionId: string): Promise<StripeSubscriptionSnapshot>;
};

export type BillingStateRepository = {
  userExists(userId: string): Promise<boolean>;
  upsertSubscription(
    userId: string,
    state: PersistedSubscriptionState
  ): Promise<EntitlementSubscription>;
  updateSubscriptionByStripeId(
    stripeSubscriptionId: string,
    state: PersistedSubscriptionState
  ): Promise<number>;
};

type StripeStateServiceDependencies = {
  provider: StripeStateProvider;
  repository: BillingStateRepository;
  prices: BillingPriceConfiguration;
  now?: () => Date;
};

const CHECKOUT_SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]{8,200}$/;

function resolvePlan(
  priceId: string | null,
  prices: BillingPriceConfiguration
): PaidPlan | null {
  if (!priceId) {
    return null;
  }

  const matches: PaidPlan[] = [];
  if (prices.monthly && priceId === prices.monthly) matches.push("MONTHLY");
  if (prices.lifetime && priceId === prices.lifetime) matches.push("LIFETIME");
  return matches.length === 1 ? matches[0] : null;
}

function exactlyOne<T>(items: ReadonlyArray<T>, hasMore: boolean): T | null {
  return items.length === 1 && !hasMore ? items[0] : null;
}

function monthlyState(
  subscription: StripeSubscriptionSnapshot,
  prices: BillingPriceConfiguration,
  now: Date
): PersistedSubscriptionState {
  const item = exactlyOne(subscription.items, subscription.itemsHaveMore);
  const candidate: EntitlementSubscription = {
    tier: "MONTHLY",
    trialEndsAt: null,
    stripePriceId: item?.priceId ?? null,
    stripeStatus: subscription.status,
    currentPeriodEnd: item?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
  const entitlement = evaluateSubscriptionEntitlement({
    subscription: candidate,
    prices,
    now,
  });

  return {
    tier:
      entitlement.granted && entitlement.source === "monthly"
        ? "MONTHLY"
        : null,
    stripePriceId: candidate.stripePriceId,
    stripeStatus: candidate.stripeStatus,
    currentPeriodEnd: candidate.currentPeriodEnd,
    cancelAtPeriodEnd: candidate.cancelAtPeriodEnd,
    stripeCustomerId: subscription.customerId,
    stripeSubscriptionId: subscription.id,
  };
}

function lifetimeState(
  customerId: string,
  priceId: string
): PersistedSubscriptionState {
  return {
    tier: "LIFETIME",
    stripeCustomerId: customerId,
    stripeSubscriptionId: null,
    stripePriceId: priceId,
    stripeStatus: "paid",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
}

function canceledState(
  subscription: StripeSubscriptionSnapshot
): PersistedSubscriptionState {
  const item = exactlyOne(subscription.items, subscription.itemsHaveMore);
  return {
    tier: "CANCELED",
    stripeCustomerId: subscription.customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: item?.priceId ?? null,
    stripeStatus: "canceled",
    currentPeriodEnd: item?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}

export function createStripeStateService({
  provider,
  repository,
  prices,
  now = () => new Date(),
}: StripeStateServiceDependencies) {
  async function synchronizeCheckout(
    checkoutSessionId: string,
    expectedUserId?: string
  ): Promise<CheckoutConfirmationResult> {
    if (!CHECKOUT_SESSION_ID.test(checkoutSessionId)) {
      return { status: "rejected" };
    }

    const checkout = await provider.retrieveCheckoutSession(checkoutSessionId);
    if (checkout.id !== checkoutSessionId) {
      return { status: "rejected" };
    }

    const userId = checkout.clientReferenceId;
    if (!userId || (expectedUserId !== undefined && userId !== expectedUserId)) {
      return { status: "rejected" };
    }
    if (!(await repository.userExists(userId))) {
      return { status: "rejected" };
    }

    const lineItem = exactlyOne(checkout.lineItems, checkout.lineItemsHaveMore);
    const plan = resolvePlan(lineItem?.priceId ?? null, prices);
    if (!lineItem || !lineItem.priceId || lineItem.quantity !== 1 || !plan) {
      return { status: "rejected" };
    }

    const expectedMode = plan === "MONTHLY" ? "subscription" : "payment";
    if (checkout.mode !== expectedMode || checkout.status !== "complete") {
      return { status: "rejected" };
    }
    if (checkout.paymentStatus === "unpaid") {
      return { status: "pending" };
    }
    if (checkout.paymentStatus !== "paid" || !checkout.customerId) {
      return { status: "rejected" };
    }

    const evaluationTime = now();
    let state: PersistedSubscriptionState;

    if (plan === "MONTHLY") {
      if (!checkout.subscriptionId) {
        return { status: "rejected" };
      }
      const subscription = await provider.retrieveSubscription(checkout.subscriptionId);
      const subscriptionItem = exactlyOne(
        subscription.items,
        subscription.itemsHaveMore
      );
      if (
        subscription.id !== checkout.subscriptionId ||
        subscription.customerId !== checkout.customerId ||
        subscriptionItem?.priceId !== lineItem.priceId
      ) {
        return { status: "rejected" };
      }
      state = monthlyState(subscription, prices, evaluationTime);
    } else {
      state = lifetimeState(checkout.customerId, lineItem.priceId);
    }

    const persisted = await repository.upsertSubscription(userId, state);
    const entitlement = evaluateSubscriptionEntitlement({
      subscription: persisted,
      prices,
      now: evaluationTime,
    });
    const expectedSource = plan === "MONTHLY" ? "monthly" : "lifetime";

    return entitlement.granted && entitlement.source === expectedSource
      ? { status: "confirmed", plan }
      : { status: "rejected" };
  }

  return {
    async confirmPaidCheckoutForUser(input: {
      checkoutSessionId: string;
      userId: string;
    }): Promise<CheckoutConfirmationResult> {
      if (!input.userId || !CHECKOUT_SESSION_ID.test(input.checkoutSessionId)) {
        return { status: "rejected" };
      }

      try {
        return await synchronizeCheckout(input.checkoutSessionId, input.userId);
      } catch {
        return { status: "pending" };
      }
    },

    synchronizeCheckoutForWebhook(checkoutSessionId: string) {
      return synchronizeCheckout(checkoutSessionId);
    },

    async synchronizeSubscriptionUpdated(
      subscription: StripeSubscriptionSnapshot
    ): Promise<void> {
      const state = monthlyState(subscription, prices, now());
      const count = await repository.updateSubscriptionByStripeId(
        subscription.id,
        state
      );
      if (count !== 1) {
        throw new Error("Stripe subscription state could not be synchronized");
      }
    },

    async synchronizeSubscriptionDeleted(
      subscription: StripeSubscriptionSnapshot
    ): Promise<void> {
      const count = await repository.updateSubscriptionByStripeId(
        subscription.id,
        canceledState(subscription)
      );
      if (count !== 1) {
        throw new Error("Stripe subscription deletion could not be synchronized");
      }
    },
  };
}

function expandableId(value: { id: string } | string | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function subscriptionSnapshot(
  subscription: Stripe.Subscription
): StripeSubscriptionSnapshot {
  return {
    id: subscription.id,
    customerId: expandableId(subscription.customer),
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    items: subscription.items.data.map((item) => ({
      priceId: item.price?.id ?? null,
      currentPeriodEnd: Number.isFinite(item.current_period_end)
        ? new Date(item.current_period_end * 1000)
        : null,
    })),
    itemsHaveMore: subscription.items.has_more,
  };
}

function productionService() {
  const stripe = getStripe();

  return createStripeStateService({
    prices: {
      monthly: PRICE_ENV_BY_PLAN.MONTHLY,
      lifetime: PRICE_ENV_BY_PLAN.LIFETIME,
    },
    provider: {
      async retrieveCheckoutSession(checkoutSessionId) {
        const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
          expand: ["line_items"],
        });
        return {
          id: session.id,
          clientReferenceId: session.client_reference_id,
          customerId: expandableId(session.customer),
          subscriptionId: expandableId(session.subscription),
          mode: session.mode,
          status: session.status,
          paymentStatus: session.payment_status,
          lineItems:
            session.line_items?.data.map((item) => ({
              priceId: item.price?.id ?? null,
              quantity: item.quantity,
            })) ?? [],
          lineItemsHaveMore: session.line_items?.has_more ?? false,
        };
      },
      async retrieveSubscription(stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        return subscriptionSnapshot(subscription);
      },
    },
    repository: {
      async userExists(userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        return user !== null;
      },
      async upsertSubscription(userId, state) {
        return prisma.subscription.upsert({
          where: { userId },
          create: { userId, ...state },
          update: state,
          select: {
            tier: true,
            trialEndsAt: true,
            stripePriceId: true,
            stripeStatus: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        });
      },
      async updateSubscriptionByStripeId(stripeSubscriptionId, state) {
        const result = await prisma.subscription.updateMany({
          where: { stripeSubscriptionId },
          data: state,
        });
        return result.count;
      },
    },
  });
}

export async function confirmPaidCheckoutForUser(input: {
  checkoutSessionId: string;
  userId: string;
}): Promise<CheckoutConfirmationResult> {
  return productionService().confirmPaidCheckoutForUser(input);
}

export async function synchronizeCheckoutForWebhook(
  checkoutSessionId: string
): Promise<CheckoutConfirmationResult> {
  return productionService().synchronizeCheckoutForWebhook(checkoutSessionId);
}

export async function synchronizeSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  return productionService().synchronizeSubscriptionUpdated(
    subscriptionSnapshot(subscription)
  );
}

export async function synchronizeSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  return productionService().synchronizeSubscriptionDeleted(
    subscriptionSnapshot(subscription)
  );
}
