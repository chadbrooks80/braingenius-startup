import "server-only";
import prisma from "@/lib/db";
import type { LearningSubscriptionTier } from "@/types/learning";
import {
  evaluateSubscriptionEntitlement,
  type BillingPriceConfiguration,
  type EntitlementSubscription,
} from "@/lib/billing/entitlement";

// General server-only resolver for the current effective Learning Module
// access tier of an authenticated user. Deliberately independent from
// src/lib/billing/user-entitlement.ts and
// src/lib/learning-engine/speech/ttsUsageService.ts: those own TTS-specific
// manual suspension, usage metering, and provider/request-kind policy, none
// of which belongs to generic application/module authorization. Both this
// resolver and the TTS resolver reuse the same unchanged
// evaluateSubscriptionEntitlement() rules so a subscription's grant/deny
// boundary is never duplicated.

const SUBSCRIPTION_ENTITLEMENT_SELECT = {
  tier: true,
  trialEndsAt: true,
  stripePriceId: true,
  stripeStatus: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
} as const;

type EffectiveTierUserRow = {
  id: string;
  role: string | null;
  mustResetPassword: boolean;
  subscription: EntitlementSubscription | null;
};

type EffectiveTierParentRow = {
  parentId: string;
  parent: {
    subscription: EntitlementSubscription | null;
  };
};

export type EffectiveSubscriptionTierDb = {
  findUserForEffectiveTier(userId: string): Promise<EffectiveTierUserRow | null>;
  findLinkedParentsForEffectiveTier(
    studentId: string
  ): Promise<EffectiveTierParentRow[]>;
};

// Read lazily on every resolution (not at module load) so a missing price
// variable fails closed at the boundary and tests can vary configuration.
export function readModuleAccessBillingPrices(): BillingPriceConfiguration {
  return {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    lifetime: process.env.STRIPE_PRICE_LIFETIME,
  };
}

const prismaEffectiveTierDb: EffectiveSubscriptionTierDb = {
  findUserForEffectiveTier(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        mustResetPassword: true,
        subscription: { select: SUBSCRIPTION_ENTITLEMENT_SELECT },
      },
    });
  },
  findLinkedParentsForEffectiveTier(studentId) {
    // Stable ascending parent-ID order keeps the selected principal tier
    // identical between requests even if historical data links multiple
    // entitled parents.
    return prisma.parentStudent.findMany({
      where: { studentId },
      orderBy: { parentId: "asc" },
      select: {
        parentId: true,
        parent: { select: { subscription: { select: SUBSCRIPTION_ENTITLEMENT_SELECT } } },
      },
    });
  },
};

export type ResolveEffectiveSubscriptionTierDeps = {
  db?: EffectiveSubscriptionTierDb;
  prices?: BillingPriceConfiguration;
  now?: Date;
};

/**
 * Resolves the authenticated caller's current effective Learning Module
 * access tier: a direct current entitlement first, otherwise the first
 * currently entitled linked parent's tier for a database CHILD, otherwise
 * `null`. A reset-required or missing caller always resolves to `null`, so
 * every consumer denies without needing its own separate account-state
 * lookup. Database failures propagate so callers fail closed instead of
 * granting access.
 */
export async function resolveEffectiveSubscriptionTier(
  userId: string,
  deps: ResolveEffectiveSubscriptionTierDeps = {}
): Promise<LearningSubscriptionTier | null> {
  const db = deps.db ?? prismaEffectiveTierDb;
  const prices = deps.prices ?? readModuleAccessBillingPrices();
  const now = deps.now ?? new Date();

  const user = await db.findUserForEffectiveTier(userId);
  if (!user || user.mustResetPassword) {
    return null;
  }

  const direct = evaluateSubscriptionEntitlement({
    subscription: user.subscription,
    prices,
    now,
  });
  if (direct.granted) {
    return user.subscription!.tier as LearningSubscriptionTier;
  }

  if (user.role !== "CHILD") {
    return null;
  }

  const parents = await db.findLinkedParentsForEffectiveTier(user.id);
  for (const link of parents) {
    const inherited = evaluateSubscriptionEntitlement({
      subscription: link.parent.subscription,
      prices,
      now,
    });
    if (inherited.granted) {
      return link.parent.subscription!.tier as LearningSubscriptionTier;
    }
  }

  return null;
}
