import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateSubscriptionEntitlement,
  type EntitlementSubscription,
} from "../../src/lib/billing/entitlement";

const NOW = new Date("2026-07-28T20:00:00.000Z");
const BEFORE_NOW = new Date(NOW.getTime() - 1);
const AFTER_NOW = new Date(NOW.getTime() + 1);
const PRICES = { monthly: "price_monthly", lifetime: "price_lifetime" };

const BASE_SUBSCRIPTION: EntitlementSubscription = {
  tier: null,
  trialEndsAt: null,
  stripePriceId: null,
  stripeStatus: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

function subscription(
  overrides: Partial<EntitlementSubscription>
): EntitlementSubscription {
  return { ...BASE_SUBSCRIPTION, ...overrides };
}

test("administrative access grants without Stripe state", () => {
  assert.deepEqual(
    evaluateSubscriptionEntitlement({
      subscription: subscription({ tier: "ADMIN" }),
      prices: { monthly: null, lifetime: null },
      now: NOW,
    }),
    { granted: true, source: "administrative" }
  );
});

test("free trial grants strictly before expiry and denies at or after expiry", () => {
  for (const [name, trialEndsAt, granted] of [
    ["before expiry", AFTER_NOW, true],
    ["at expiry", NOW, false],
    ["after expiry", BEFORE_NOW, false],
    ["without expiry", null, false],
  ] as const) {
    const result = evaluateSubscriptionEntitlement({
      subscription: subscription({ tier: "FREE_TRIAL", trialEndsAt }),
      prices: PRICES,
      now: NOW,
    });

    assert.equal(result.granted, granted, name);
  }
});

test("lifetime access requires the approved price and paid state", () => {
  for (const [name, stripePriceId, stripeStatus, granted] of [
    ["approved paid", PRICES.lifetime, "paid", true],
    ["unpaid", PRICES.lifetime, "unpaid", false],
    ["unknown status", PRICES.lifetime, "future_status", false],
    ["wrong price", PRICES.monthly, "paid", false],
    ["missing price", null, "paid", false],
    ["missing configured price", PRICES.lifetime, "paid", false],
  ] as const) {
    const result = evaluateSubscriptionEntitlement({
      subscription: subscription({ tier: "LIFETIME", stripePriceId, stripeStatus }),
      prices:
        name === "missing configured price"
          ? { ...PRICES, lifetime: null }
          : PRICES,
      now: NOW,
    });

    assert.equal(result.granted, granted, name);
  }
});

test("monthly access uses a strict status, price, and period allowlist", () => {
  for (const [name, stripeStatus, stripePriceId, currentPeriodEnd, granted] of [
    ["active", "active", PRICES.monthly, AFTER_NOW, true],
    ["trialing", "trialing", PRICES.monthly, AFTER_NOW, true],
    ["past_due", "past_due", PRICES.monthly, AFTER_NOW, false],
    ["unpaid", "unpaid", PRICES.monthly, AFTER_NOW, false],
    ["incomplete", "incomplete", PRICES.monthly, AFTER_NOW, false],
    ["incomplete_expired", "incomplete_expired", PRICES.monthly, AFTER_NOW, false],
    ["paused", "paused", PRICES.monthly, AFTER_NOW, false],
    ["canceled", "canceled", PRICES.monthly, AFTER_NOW, false],
    ["missing status", null, PRICES.monthly, AFTER_NOW, false],
    ["unknown status", "future_status", PRICES.monthly, AFTER_NOW, false],
    ["wrong price", "active", PRICES.lifetime, AFTER_NOW, false],
    ["missing price", "active", null, AFTER_NOW, false],
    ["period at boundary", "active", PRICES.monthly, NOW, false],
    ["expired period", "active", PRICES.monthly, BEFORE_NOW, false],
    ["missing period", "active", PRICES.monthly, null, false],
  ] as const) {
    const result = evaluateSubscriptionEntitlement({
      subscription: subscription({
        tier: "MONTHLY",
        stripeStatus,
        stripePriceId,
        currentPeriodEnd,
      }),
      prices: PRICES,
      now: NOW,
    });

    assert.equal(result.granted, granted, name);
  }
});

test("cancel-at-period-end grants only through the unexpired period", () => {
  const beforeEnd = evaluateSubscriptionEntitlement({
    subscription: subscription({
      tier: "MONTHLY",
      stripePriceId: PRICES.monthly,
      stripeStatus: "active",
      currentPeriodEnd: AFTER_NOW,
      cancelAtPeriodEnd: true,
    }),
    prices: PRICES,
    now: NOW,
  });
  const atEnd = evaluateSubscriptionEntitlement({
    subscription: subscription({
      tier: "MONTHLY",
      stripePriceId: PRICES.monthly,
      stripeStatus: "active",
      currentPeriodEnd: NOW,
      cancelAtPeriodEnd: true,
    }),
    prices: PRICES,
    now: NOW,
  });

  assert.equal(beforeEnd.granted, true);
  assert.equal(atEnd.granted, false);
});

test("missing, canceled, null-tier, and unknown future tiers fail closed", () => {
  assert.deepEqual(
    evaluateSubscriptionEntitlement({ subscription: null, prices: PRICES, now: NOW }),
    { granted: false, reason: "missing_subscription" }
  );

  for (const tier of [null, "CANCELED", "FUTURE_TIER"]) {
    assert.equal(
      evaluateSubscriptionEntitlement({
        subscription: subscription({ tier }),
        prices: PRICES,
        now: NOW,
      }).granted,
      false,
      String(tier)
    );
  }
});
