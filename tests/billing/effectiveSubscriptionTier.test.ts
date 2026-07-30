import { test } from "node:test";
import assert from "node:assert/strict";
import type { EntitlementSubscription } from "../../src/lib/billing/entitlement";
import {
  resolveEffectiveSubscriptionTier,
  type EffectiveSubscriptionTierDb,
} from "../../src/lib/billing/effective-subscription-tier";

const NOW = new Date("2026-07-29T12:00:00Z");
const PRICES = { monthly: "price_monthly", lifetime: "price_lifetime" };

type SeedUser = {
  id: string;
  role?: string | null;
  mustResetPassword?: boolean;
  subscription?: EntitlementSubscription | null;
  parentIds?: string[];
};

function createFakeDb(
  seed: SeedUser[]
): EffectiveSubscriptionTierDb & { failNext: () => void } {
  const users = new Map(
    seed.map((user) => [
      user.id,
      {
        id: user.id,
        role: user.role ?? "PARENT",
        mustResetPassword: user.mustResetPassword ?? false,
        subscription: user.subscription ?? null,
        parentIds: user.parentIds ?? [],
      },
    ])
  );
  let failNext = false;

  return {
    failNext() {
      failNext = true;
    },
    async findUserForEffectiveTier(userId) {
      if (failNext) {
        failNext = false;
        throw new Error("simulated database failure");
      }
      const user = users.get(userId);
      return user
        ? {
            id: user.id,
            role: user.role,
            mustResetPassword: user.mustResetPassword,
            subscription: user.subscription,
          }
        : null;
    },
    async findLinkedParentsForEffectiveTier(studentId) {
      const student = users.get(studentId);
      if (!student) {
        return [];
      }
      return [...student.parentIds]
        .sort()
        .map((parentId) => {
          const parent = users.get(parentId);
          return {
            parentId,
            parent: { subscription: parent?.subscription ?? null },
          };
        });
    },
  };
}

function monthly(overrides: Partial<EntitlementSubscription> = {}): EntitlementSubscription {
  return {
    tier: "MONTHLY",
    trialEndsAt: null,
    stripePriceId: PRICES.monthly,
    stripeStatus: "active",
    currentPeriodEnd: new Date(NOW.getTime() + 86_400_000),
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function admin(): EntitlementSubscription {
  return {
    tier: "ADMIN",
    trialEndsAt: null,
    stripePriceId: null,
    stripeStatus: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
}

function freeTrial(overrides: Partial<EntitlementSubscription> = {}): EntitlementSubscription {
  return {
    tier: "FREE_TRIAL",
    trialEndsAt: new Date(NOW.getTime() + 1),
    stripePriceId: null,
    stripeStatus: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function deps(db: EffectiveSubscriptionTierDb) {
  return { db, prices: PRICES, now: NOW };
}

test("a user missing from the database resolves to null", async () => {
  const db = createFakeDb([]);
  assert.equal(await resolveEffectiveSubscriptionTier("user-ghost", deps(db)), null);
});

test("a direct current entitlement resolves to its actual tier", async () => {
  for (const subscription of [admin(), monthly(), freeTrial()]) {
    const db = createFakeDb([{ id: "user-1", subscription }]);
    assert.equal(
      await resolveEffectiveSubscriptionTier("user-1", deps(db)),
      subscription.tier,
      `${subscription.tier} must resolve truthfully`
    );
  }
});

test("expired, inactive, canceled, unknown-tier, and price-mismatched subscriptions resolve to null", async () => {
  const denials: EntitlementSubscription[] = [
    freeTrial({ trialEndsAt: NOW }),
    monthly({ stripeStatus: "canceled" }),
    monthly({ stripePriceId: "price_other" }),
    monthly({ currentPeriodEnd: NOW }),
    { ...admin(), tier: "CANCELED" },
    { ...admin(), tier: "UNKNOWN_TIER" },
  ];

  for (const subscription of denials) {
    const db = createFakeDb([{ id: "user-1", subscription }]);
    assert.equal(
      await resolveEffectiveSubscriptionTier("user-1", deps(db)),
      null,
      `${subscription.tier}/${subscription.stripeStatus} must resolve to null`
    );
  }
});

test("a non-child with no direct entitlement never inherits from a link", async () => {
  const db = createFakeDb([
    { id: "parent-1", subscription: monthly() },
    { id: "student-1", role: "STUDENT", parentIds: ["parent-1"] },
  ]);
  assert.equal(await resolveEffectiveSubscriptionTier("student-1", deps(db)), null);
});

test("a child without direct entitlement inherits the first entitled parent's actual tier", async () => {
  const db = createFakeDb([
    { id: "parent-1", subscription: monthly() },
    { id: "child-1", role: "CHILD", parentIds: ["parent-1"] },
  ]);
  assert.equal(await resolveEffectiveSubscriptionTier("child-1", deps(db)), "MONTHLY");
});

test("multiple linked parents resolve to the first entitled parent in stable ascending parent-ID order", async () => {
  const db = createFakeDb([
    { id: "parent-a", subscription: monthly({ stripeStatus: "canceled" }) },
    { id: "parent-b", subscription: admin() },
    { id: "parent-c", subscription: monthly() },
    {
      id: "child-1",
      role: "CHILD",
      parentIds: ["parent-c", "parent-a", "parent-b"],
    },
  ]);

  // parent-a is first ascending but not entitled; parent-b is the first
  // entitled parent and stays the principal even though parent-c is also
  // entitled.
  assert.equal(await resolveEffectiveSubscriptionTier("child-1", deps(db)), "ADMIN");
});

test("a child with no entitled parent resolves to null", async () => {
  const db = createFakeDb([
    { id: "parent-1", subscription: monthly({ stripeStatus: "canceled" }) },
    { id: "child-1", role: "CHILD", parentIds: ["parent-1"] },
  ]);
  assert.equal(await resolveEffectiveSubscriptionTier("child-1", deps(db)), null);
});

test("a reset-required caller resolves to null for both direct and inherited entitlement", async () => {
  const direct = createFakeDb([
    { id: "user-1", subscription: admin(), mustResetPassword: true },
  ]);
  assert.equal(await resolveEffectiveSubscriptionTier("user-1", deps(direct)), null);

  const inherited = createFakeDb([
    { id: "parent-1", subscription: admin() },
    {
      id: "child-1",
      role: "CHILD",
      parentIds: ["parent-1"],
      mustResetPassword: true,
    },
  ]);
  assert.equal(await resolveEffectiveSubscriptionTier("child-1", deps(inherited)), null);
});

test("missing price configuration resolves paid tiers to null", async () => {
  const db = createFakeDb([{ id: "user-1", subscription: monthly() }]);
  assert.equal(
    await resolveEffectiveSubscriptionTier("user-1", {
      db,
      prices: { monthly: undefined, lifetime: undefined },
      now: NOW,
    }),
    null
  );
});

test("cancel-at-period-end resolves the tier only strictly before the period boundary", async () => {
  const boundary = new Date("2026-08-01T00:00:00Z");
  const db = createFakeDb([
    {
      id: "user-1",
      subscription: monthly({ cancelAtPeriodEnd: true, currentPeriodEnd: boundary }),
    },
  ]);

  const before = await resolveEffectiveSubscriptionTier("user-1", {
    db,
    prices: PRICES,
    now: new Date(boundary.getTime() - 1),
  });
  assert.equal(before, "MONTHLY");

  const atBoundary = await resolveEffectiveSubscriptionTier("user-1", {
    db,
    prices: PRICES,
    now: boundary,
  });
  assert.equal(atBoundary, null);
});

test("a database failure propagates so the caller fails closed", async () => {
  const db = createFakeDb([{ id: "user-1", subscription: admin() }]);
  db.failNext();
  await assert.rejects(() => resolveEffectiveSubscriptionTier("user-1", deps(db)));
});
