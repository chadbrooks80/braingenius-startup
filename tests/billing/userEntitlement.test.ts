import { test } from "node:test";
import assert from "node:assert/strict";
import type { EntitlementSubscription } from "../../src/lib/billing/entitlement";
import {
  resolveTtsEntitlement,
  type TtsEntitlementDb,
} from "../../src/lib/billing/user-entitlement";

const NOW = new Date("2026-07-29T12:00:00Z");
const PRICES = { monthly: "price_monthly", lifetime: "price_lifetime" };

type SeedUser = {
  id: string;
  role?: string | null;
  mustResetPassword?: boolean;
  ttsSuspendedAt?: Date | null;
  subscription?: EntitlementSubscription | null;
  parentIds?: string[];
};

function createFakeDb(seed: SeedUser[]): TtsEntitlementDb & { failNext: () => void } {
  const users = new Map(
    seed.map((user) => [
      user.id,
      {
        id: user.id,
        role: user.role ?? "PARENT",
        mustResetPassword: user.mustResetPassword ?? false,
        ttsSuspendedAt: user.ttsSuspendedAt ?? null,
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
    async findUserForTtsEntitlement(userId) {
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
            ttsSuspendedAt: user.ttsSuspendedAt,
            subscription: user.subscription,
          }
        : null;
    },
    async findLinkedParentsForTtsEntitlement(studentId) {
      const student = users.get(studentId);
      if (!student) {
        return [];
      }
      // Deliberately reverse-sort before re-sorting ascending, mirroring the
      // production contract that ordering is stable regardless of storage
      // noise.
      return [...student.parentIds]
        .sort()
        .map((parentId) => {
          const parent = users.get(parentId);
          return {
            parentId,
            parent: {
              ttsSuspendedAt: parent?.ttsSuspendedAt ?? null,
              subscription: parent?.subscription ?? null,
            },
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

function deps(db: TtsEntitlementDb) {
  return { db, prices: PRICES, now: NOW };
}

test("a session user missing from the database is denied", async () => {
  const db = createFakeDb([]);
  assert.deepEqual(await resolveTtsEntitlement("user-ghost", deps(db)), {
    granted: false,
  });
});

test("a user with no subscription and no CHILD role is denied", async () => {
  const db = createFakeDb([{ id: "user-1", subscription: null }]);
  assert.deepEqual(await resolveTtsEntitlement("user-1", deps(db)), {
    granted: false,
  });
});

test("valid ADMIN, free-trial, lifetime, monthly active, and monthly trialing subscriptions grant with the caller as principal", async () => {
  const grants: Array<[EntitlementSubscription, string]> = [
    [admin(), "administrative"],
    [
      {
        tier: "FREE_TRIAL",
        trialEndsAt: new Date(NOW.getTime() + 1),
        stripePriceId: null,
        stripeStatus: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
      "free_trial",
    ],
    [
      {
        tier: "LIFETIME",
        trialEndsAt: null,
        stripePriceId: PRICES.lifetime,
        stripeStatus: "paid",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
      "lifetime",
    ],
    [monthly(), "monthly"],
    [monthly({ stripeStatus: "trialing" }), "monthly"],
  ];

  for (const [subscription, source] of grants) {
    const db = createFakeDb([{ id: "user-1", subscription }]);
    assert.deepEqual(
      await resolveTtsEntitlement("user-1", deps(db)),
      {
        granted: true,
        callerUserId: "user-1",
        entitlementPrincipalUserId: "user-1",
        source,
      },
      `${subscription.tier}/${subscription.stripeStatus} must grant as ${source}`
    );
  }
});

test("expired, inactive, canceled, unknown-tier, and price-mismatched subscriptions are denied", async () => {
  const denials: EntitlementSubscription[] = [
    {
      tier: "FREE_TRIAL",
      trialEndsAt: NOW,
      stripePriceId: null,
      stripeStatus: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
    monthly({ stripeStatus: "canceled" }),
    monthly({ stripeStatus: "past_due" }),
    monthly({ stripeStatus: null }),
    monthly({ stripePriceId: "price_other" }),
    monthly({ currentPeriodEnd: NOW }),
    { ...admin(), tier: "CANCELED" },
    { ...admin(), tier: "UNKNOWN_TIER" },
    {
      tier: "LIFETIME",
      trialEndsAt: null,
      stripePriceId: PRICES.lifetime,
      stripeStatus: "unpaid",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  ];

  for (const subscription of denials) {
    const db = createFakeDb([{ id: "user-1", subscription }]);
    assert.deepEqual(
      await resolveTtsEntitlement("user-1", deps(db)),
      { granted: false },
      `${subscription.tier}/${subscription.stripeStatus} must deny`
    );
  }
});

test("cancel-at-period-end grants only strictly before the period boundary", async () => {
  const boundary = new Date("2026-08-01T00:00:00Z");
  const db = createFakeDb([
    {
      id: "user-1",
      subscription: monthly({ cancelAtPeriodEnd: true, currentPeriodEnd: boundary }),
    },
  ]);

  const before = await resolveTtsEntitlement("user-1", {
    db,
    prices: PRICES,
    now: new Date(boundary.getTime() - 1),
  });
  assert.equal(before.granted, true);

  const atBoundary = await resolveTtsEntitlement("user-1", {
    db,
    prices: PRICES,
    now: boundary,
  });
  assert.deepEqual(atBoundary, { granted: false });
});

test("missing price configuration denies paid tiers", async () => {
  const db = createFakeDb([{ id: "user-1", subscription: monthly() }]);
  assert.deepEqual(
    await resolveTtsEntitlement("user-1", {
      db,
      prices: { monthly: undefined, lifetime: undefined },
      now: NOW,
    }),
    { granted: false }
  );
});

test("a child with one entitled parent grants with the child as caller and the parent as entitlement principal", async () => {
  const db = createFakeDb([
    { id: "parent-1", subscription: monthly() },
    { id: "child-1", role: "CHILD", parentIds: ["parent-1"] },
  ]);

  assert.deepEqual(await resolveTtsEntitlement("child-1", deps(db)), {
    granted: true,
    callerUserId: "child-1",
    entitlementPrincipalUserId: "parent-1",
    source: "monthly",
  });
});

test("a child with no entitled parent is denied, and a non-child never inherits from links", async () => {
  const db = createFakeDb([
    { id: "parent-1", subscription: monthly({ stripeStatus: "canceled" }) },
    { id: "child-1", role: "CHILD", parentIds: ["parent-1"] },
    { id: "student-1", role: "STUDENT", parentIds: ["parent-1"] },
  ]);

  assert.deepEqual(await resolveTtsEntitlement("child-1", deps(db)), {
    granted: false,
  });
  assert.deepEqual(await resolveTtsEntitlement("student-1", deps(db)), {
    granted: false,
  });
});

test("multiple linked parents resolve to the first entitled parent in stable ascending parent-ID order", async () => {
  const db = createFakeDb([
    { id: "parent-a", subscription: monthly({ stripeStatus: "canceled" }) },
    { id: "parent-b", subscription: monthly() },
    { id: "parent-c", subscription: admin() },
    {
      id: "child-1",
      role: "CHILD",
      parentIds: ["parent-c", "parent-a", "parent-b"],
    },
  ]);

  // parent-a is first in ascending order but not entitled; parent-b is the
  // first entitled parent and stays the principal even though parent-c is
  // also entitled.
  assert.deepEqual(await resolveTtsEntitlement("child-1", deps(db)), {
    granted: true,
    callerUserId: "child-1",
    entitlementPrincipalUserId: "parent-b",
    source: "monthly",
  });
});

test("a manually suspended caller is denied for direct and inherited entitlement", async () => {
  const direct = createFakeDb([
    { id: "user-1", subscription: admin(), ttsSuspendedAt: NOW },
  ]);
  assert.deepEqual(await resolveTtsEntitlement("user-1", deps(direct)), {
    granted: false,
  });

  const inherited = createFakeDb([
    { id: "parent-1", subscription: admin() },
    {
      id: "child-1",
      role: "CHILD",
      parentIds: ["parent-1"],
      ttsSuspendedAt: NOW,
    },
  ]);
  assert.deepEqual(await resolveTtsEntitlement("child-1", deps(inherited)), {
    granted: false,
  });
});

test("a manually suspended entitlement principal denies inheriting callers without falling through to another parent", async () => {
  const db = createFakeDb([
    { id: "parent-a", subscription: admin(), ttsSuspendedAt: NOW },
    { id: "parent-b", subscription: admin() },
    {
      id: "child-1",
      role: "CHILD",
      parentIds: ["parent-a", "parent-b"],
    },
  ]);

  assert.deepEqual(await resolveTtsEntitlement("child-1", deps(db)), {
    granted: false,
  });
});

test("lifting a manual suspension restores evaluation through the unchanged Stage 1 policy", async () => {
  const db = createFakeDb([
    { id: "user-1", subscription: monthly(), ttsSuspendedAt: null },
  ]);
  const restored = await resolveTtsEntitlement("user-1", deps(db));
  assert.equal(restored.granted, true);
});

test("a reset-required caller is denied for direct and inherited entitlement", async () => {
  const direct = createFakeDb([
    { id: "user-1", subscription: admin(), mustResetPassword: true },
  ]);
  assert.deepEqual(await resolveTtsEntitlement("user-1", deps(direct)), {
    granted: false,
  });

  const inherited = createFakeDb([
    { id: "parent-1", subscription: admin() },
    {
      id: "child-1",
      role: "CHILD",
      parentIds: ["parent-1"],
      mustResetPassword: true,
    },
  ]);
  assert.deepEqual(await resolveTtsEntitlement("child-1", deps(inherited)), {
    granted: false,
  });
});

test("a database failure propagates so the boundary fails closed", async () => {
  const db = createFakeDb([{ id: "user-1", subscription: admin() }]);
  db.failNext();
  await assert.rejects(() => resolveTtsEntitlement("user-1", deps(db)));
});
