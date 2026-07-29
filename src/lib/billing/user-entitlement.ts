import "server-only";
import prisma from "@/lib/db";
import {
  evaluateSubscriptionEntitlement,
  type BillingPriceConfiguration,
  type EntitlementGrantSource,
  type EntitlementSubscription,
} from "@/lib/billing/entitlement";

// Narrow server-only resolver that maps an authenticated user ID to a paid
// TTS entitlement decision through the unchanged Stage 1 evaluator. It reads
// the caller from the database on every call: a stale or forged browser
// identity is never trusted without this lookup, and no decision is cached.

export type TtsEntitlementDecision =
  | {
      granted: true;
      callerUserId: string;
      entitlementPrincipalUserId: string;
      source: EntitlementGrantSource;
    }
  | { granted: false };

const SUBSCRIPTION_ENTITLEMENT_SELECT = {
  tier: true,
  trialEndsAt: true,
  stripePriceId: true,
  stripeStatus: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
} as const;

type EntitlementUserRow = {
  id: string;
  role: string | null;
  ttsSuspendedAt: Date | null;
  subscription: EntitlementSubscription | null;
};

type EntitlementParentRow = {
  parentId: string;
  parent: {
    ttsSuspendedAt: Date | null;
    subscription: EntitlementSubscription | null;
  };
};

export type TtsEntitlementDb = {
  findUserForTtsEntitlement(userId: string): Promise<EntitlementUserRow | null>;
  findLinkedParentsForTtsEntitlement(
    studentId: string
  ): Promise<EntitlementParentRow[]>;
};

// Read lazily on every resolution (not at module load) so a missing price
// variable fails closed at the boundary and tests can vary configuration.
export function readTtsBillingPrices(): BillingPriceConfiguration {
  return {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    lifetime: process.env.STRIPE_PRICE_LIFETIME,
  };
}

const prismaEntitlementDb: TtsEntitlementDb = {
  findUserForTtsEntitlement(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        ttsSuspendedAt: true,
        subscription: { select: SUBSCRIPTION_ENTITLEMENT_SELECT },
      },
    });
  },
  findLinkedParentsForTtsEntitlement(studentId) {
    // Stable ascending parent-ID order keeps the selected entitlement
    // principal identical between requests even if historical data links
    // multiple entitled parents.
    return prisma.parentStudent.findMany({
      where: { studentId },
      orderBy: { parentId: "asc" },
      select: {
        parentId: true,
        parent: {
          select: {
            ttsSuspendedAt: true,
            subscription: { select: SUBSCRIPTION_ENTITLEMENT_SELECT },
          },
        },
      },
    });
  },
};

export type ResolveTtsEntitlementDeps = {
  db?: TtsEntitlementDb;
  prices?: BillingPriceConfiguration;
  now?: Date;
};

/**
 * Resolves the authenticated caller's current paid TTS entitlement.
 *
 * Direct entitlement is evaluated first. A CHILD without direct entitlement
 * may inherit from the first currently entitled linked parent, which becomes
 * the entitlement principal while the child remains the caller. An active
 * manual TTS suspension on the caller or the principal denies; suspending
 * the principal is the deliberate way to pause a whole entitled family.
 * Database failures propagate so the boundary fails closed as unavailable.
 */
export async function resolveTtsEntitlement(
  callerUserId: string,
  deps: ResolveTtsEntitlementDeps = {}
): Promise<TtsEntitlementDecision> {
  const db = deps.db ?? prismaEntitlementDb;
  const prices = deps.prices ?? readTtsBillingPrices();
  const now = deps.now ?? new Date();

  const caller = await db.findUserForTtsEntitlement(callerUserId);
  if (!caller) {
    return { granted: false };
  }

  const direct = evaluateSubscriptionEntitlement({
    subscription: caller.subscription,
    prices,
    now,
  });
  if (direct.granted) {
    if (caller.ttsSuspendedAt !== null) {
      return { granted: false };
    }
    return {
      granted: true,
      callerUserId: caller.id,
      entitlementPrincipalUserId: caller.id,
      source: direct.source,
    };
  }

  if (caller.role !== "CHILD") {
    return { granted: false };
  }

  const parents = await db.findLinkedParentsForTtsEntitlement(caller.id);
  for (const link of parents) {
    const inherited = evaluateSubscriptionEntitlement({
      subscription: link.parent.subscription,
      prices,
      now,
    });
    if (!inherited.granted) {
      continue;
    }
    // The first entitled parent is the principal. If that principal is
    // manually suspended the family's inherited access is denied rather
    // than silently falling through to another parent.
    if (caller.ttsSuspendedAt !== null || link.parent.ttsSuspendedAt !== null) {
      return { granted: false };
    }
    return {
      granted: true,
      callerUserId: caller.id,
      entitlementPrincipalUserId: link.parentId,
      source: inherited.source,
    };
  }

  return { granted: false };
}
