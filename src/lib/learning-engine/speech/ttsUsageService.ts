import "server-only";
import prisma, { lockUserRows } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import {
  evaluateSubscriptionEntitlement,
  type BillingPriceConfiguration,
  type EntitlementSubscription,
} from "@/lib/billing/entitlement";
import {
  readTtsBillingPrices,
  resolveTtsEntitlement,
  type TtsEntitlementDecision,
} from "@/lib/billing/user-entitlement";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "../errors/TtsSynthesisError";
import { logTtsSynthesisError } from "../errors/logTtsSynthesisError";
import { synthesizeTts } from "./providers/synthesizeTts";
import type { SynthesizedAudio } from "./providers/types";
import type { TtsSynthesisRequest } from "./validation/parseTtsSynthesisRequest";
import {
  measureTtsInput,
  nextUtcDayStart,
  nextUtcMinuteStart,
  retryAfterSeconds,
  TTS_FIVE_HOUR_WARNING_WORDS,
  TTS_LEASE_DURATION_MS,
  TTS_MAX_CALLER_ATTEMPTS_PER_MINUTE,
  TTS_MAX_CONCURRENT_CALLER_LEASES,
  TTS_MAX_PROVIDER_CHUNK_UTF8_BYTES,
  TTS_TEN_HOUR_CUTOFF_WORDS,
  utcDayFloor,
  utcMinuteFloor,
  type TtsInputMetrics,
} from "./ttsUsagePolicy";

// One shared server-owned access, measurement, and emergency-protection
// boundary between every browser-reachable speech handler and the paid
// provider dispatcher. All truth lives in PostgreSQL: process-local state is
// never used for usage, alerts, suspension, concurrency, or enforcement.

export type TtsUsageProviderName = "GOOGLE" | "LEMONFOX";
export type TtsUsageRequestKind = "PUBLIC_TEXT" | "VOCABULARY_PROTECTED";
export type TtsUsageScopeName = "CALLER_MINUTE" | "CALLER_DAY" | "ENTITLEMENT_DAY";
export type TtsUsageAlertKindName = "FIVE_HOUR_WARNING" | "TEN_HOUR_CUTOFF";
export type TtsRejectionCategory = "burst" | "concurrency" | "extreme";

export type TtsUsageDenial =
  | { reason: "unauthenticated" }
  | { reason: "forbidden" }
  | { reason: "rate_limited"; retryAfterSeconds: number }
  | { reason: "unavailable" };

export type PaidTtsAccess = {
  callerUserId: string;
  entitlementPrincipalUserId: string;
};

/** Thrown when paid-usage accounting cannot be confirmed; never returns audio. */
export class TtsUsageAccountingError extends Error {
  constructor(stage: "acquire" | "complete") {
    super(`Paid TTS usage accounting failed during ${stage}.`);
    this.name = "TtsUsageAccountingError";
  }
}

export type TtsUserSnapshot = {
  id: string;
  role: string | null;
  ttsSuspendedAt: Date | null;
  subscription: EntitlementSubscription | null;
};

export type TtsLinkedParentSnapshot = {
  parentId: string;
  parent: TtsUserSnapshot;
};

export type TtsLeaseRecord = {
  id: string;
  callerUserId: string;
  entitlementPrincipalUserId: string;
  provider: TtsUsageProviderName;
  requestKind: TtsUsageRequestKind;
  inputBytes: number;
  inputCharacters: number;
  inputWords: number;
  callerMinuteStart: Date;
  callerDayStart: Date;
  principalDayStart: Date;
  expiresAt: Date;
};

type BucketKey = {
  subjectUserId: string;
  scope: TtsUsageScopeName;
  windowStart: Date;
  provider: TtsUsageProviderName;
  requestKind: TtsUsageRequestKind;
};

type CompletionCounters = {
  successfulRequests: number;
  failedRequests: number;
  generatedAudioBytes: bigint;
};

export type TtsLeaseCompletionResult =
  | { finalized: true }
  | { finalized: false };

export type TtsUsageStoreTx = {
  lockEntitlementContext(callerUserId: string): Promise<void>;
  findUserForTts(userId: string): Promise<TtsUserSnapshot | null>;
  findLinkedParentsForTts(
    studentId: string
  ): Promise<TtsLinkedParentSnapshot[]>;
  deleteExpiredLeases(callerUserId: string, now: Date): Promise<void>;
  countActiveLeases(callerUserId: string, now: Date): Promise<number>;
  earliestActiveLeaseExpiry(callerUserId: string, now: Date): Promise<Date | null>;
  sumAcceptedUsage(
    subjectUserId: string,
    scope: TtsUsageScopeName,
    windowStart: Date
  ): Promise<{ acceptedRequests: number; acceptedWords: number }>;
  upsertAlert(alert: {
    callerUserId: string;
    entitlementPrincipalUserId: string;
    dayStart: Date;
    kind: TtsUsageAlertKindName;
    observedWords: number;
  }): Promise<void>;
  incrementRejection(key: BucketKey, category: TtsRejectionCategory): Promise<void>;
  addAcceptedUsage(key: BucketKey, metrics: TtsInputMetrics): Promise<void>;
  addCompletionUsage(key: BucketKey, counters: CompletionCounters): Promise<void>;
  createLease(
    lease: Omit<TtsLeaseRecord, "id">
  ): Promise<{ id: string }>;
  claimLease(leaseId: string, now: Date): Promise<TtsLeaseRecord | null>;
};

export type TtsUsageStore = {
  transact<T>(fn: (tx: TtsUsageStoreTx) => Promise<T>): Promise<T>;
};

function rejectionCounterInputs(category: TtsRejectionCategory): {
  create: {
    rejectedBurst?: number;
    rejectedConcurrency?: number;
    rejectedExtremeUsage?: number;
  };
  update: {
    rejectedBurst?: { increment: number };
    rejectedConcurrency?: { increment: number };
    rejectedExtremeUsage?: { increment: number };
  };
} {
  switch (category) {
    case "burst":
      return { create: { rejectedBurst: 1 }, update: { rejectedBurst: { increment: 1 } } };
    case "concurrency":
      return {
        create: { rejectedConcurrency: 1 },
        update: { rejectedConcurrency: { increment: 1 } },
      };
    case "extreme":
      return {
        create: { rejectedExtremeUsage: 1 },
        update: { rejectedExtremeUsage: { increment: 1 } },
      };
  }
}

const USER_TTS_SELECT = {
  id: true,
  role: true,
  ttsSuspendedAt: true,
  subscription: {
    select: {
      tier: true,
      trialEndsAt: true,
      stripePriceId: true,
      stripeStatus: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  },
} as const;

type PrismaLikeDb = typeof prisma;

export function createPrismaTtsUsageStore(db: PrismaLikeDb = prisma): TtsUsageStore {
  return {
    transact(fn) {
      return db.$transaction(async (tx) => {
        const storeTx: TtsUsageStoreTx = {
          async lockEntitlementContext(callerUserId) {
            const linksBeforeLock = await tx.parentStudent.findMany({
              where: { studentId: callerUserId },
              orderBy: { parentId: "asc" },
              select: { parentId: true },
            });
            const userIds = [
              callerUserId,
              ...linksBeforeLock.map((link) => link.parentId),
            ];

            // All possibly authoritative users are locked in one ascending
            // order before any authorization snapshot is trusted.
            await lockUserRows(tx, userIds);

            // Lock every current relationship row so a concurrent removal
            // cannot invalidate inherited access after it is checked.
            const lockedLinks = await tx.$queryRaw<Array<{ parentId: string }>>`
              SELECT "parentId"
              FROM "ParentStudent"
              WHERE "studentId" = ${callerUserId}
              ORDER BY "parentId"
              FOR UPDATE
            `;
            const expectedParentIds = linksBeforeLock.map((link) => link.parentId);
            const lockedParentIds = lockedLinks.map((link) => link.parentId);
            if (
              expectedParentIds.length !== lockedParentIds.length ||
              expectedParentIds.some(
                (parentId, index) => parentId !== lockedParentIds[index]
              )
            ) {
              throw new Error(
                "TTS entitlement relationships changed during acquisition."
              );
            }

            // Existing subscription rows are also locked while the unchanged
            // Stage 1 evaluator selects direct or inherited entitlement.
            await tx.$queryRaw(
              Prisma.sql`
                SELECT "userId"
                FROM "Subscription"
                WHERE "userId" IN (${Prisma.join(userIds)})
                ORDER BY "userId"
                FOR UPDATE
              `
            );
          },
          findUserForTts: (userId) =>
            tx.user.findUnique({ where: { id: userId }, select: USER_TTS_SELECT }),
          findLinkedParentsForTts: (studentId) =>
            tx.parentStudent.findMany({
              where: { studentId },
              orderBy: { parentId: "asc" },
              select: {
                parentId: true,
                parent: { select: USER_TTS_SELECT },
              },
            }),
          async deleteExpiredLeases(callerUserId, now) {
            await tx.ttsRequestLease.deleteMany({
              where: { callerUserId, expiresAt: { lte: now } },
            });
          },
          countActiveLeases: (callerUserId, now) =>
            tx.ttsRequestLease.count({
              where: { callerUserId, expiresAt: { gt: now } },
            }),
          async earliestActiveLeaseExpiry(callerUserId, now) {
            const lease = await tx.ttsRequestLease.findFirst({
              where: { callerUserId, expiresAt: { gt: now } },
              orderBy: { expiresAt: "asc" },
              select: { expiresAt: true },
            });
            return lease?.expiresAt ?? null;
          },
          async sumAcceptedUsage(subjectUserId, scope, windowStart) {
            const sums = await tx.ttsUsageBucket.aggregate({
              where: { subjectUserId, scope, windowStart },
              _sum: { acceptedRequests: true, acceptedWords: true },
            });
            return {
              acceptedRequests: sums._sum.acceptedRequests ?? 0,
              acceptedWords: sums._sum.acceptedWords ?? 0,
            };
          },
          async upsertAlert(alert) {
            await tx.ttsUsageAlert.upsert({
              where: {
                callerUserId_dayStart_kind: {
                  callerUserId: alert.callerUserId,
                  dayStart: alert.dayStart,
                  kind: alert.kind,
                },
              },
              create: alert,
              update: {},
            });
          },
          async incrementRejection(key, category) {
            const counters = rejectionCounterInputs(category);
            await tx.ttsUsageBucket.upsert({
              where: { subjectUserId_scope_windowStart_provider_requestKind: key },
              create: { ...key, ...counters.create },
              update: counters.update,
            });
          },
          async addAcceptedUsage(key, metrics) {
            await tx.ttsUsageBucket.upsert({
              where: { subjectUserId_scope_windowStart_provider_requestKind: key },
              create: {
                ...key,
                acceptedRequests: 1,
                acceptedInputBytes: metrics.utf8Bytes,
                acceptedInputCharacters: metrics.characters,
                acceptedWords: metrics.words,
              },
              update: {
                acceptedRequests: { increment: 1 },
                acceptedInputBytes: { increment: metrics.utf8Bytes },
                acceptedInputCharacters: { increment: metrics.characters },
                acceptedWords: { increment: metrics.words },
              },
            });
          },
          async addCompletionUsage(key, counters) {
            await tx.ttsUsageBucket.upsert({
              where: { subjectUserId_scope_windowStart_provider_requestKind: key },
              create: { ...key, ...counters },
              update: {
                successfulRequests: { increment: counters.successfulRequests },
                failedRequests: { increment: counters.failedRequests },
                generatedAudioBytes: { increment: counters.generatedAudioBytes },
              },
            });
          },
          async createLease(lease) {
            const created = await tx.ttsRequestLease.create({
              data: lease,
              select: { id: true },
            });
            return created;
          },
          async claimLease(leaseId, now) {
            const lease = await tx.ttsRequestLease.findUnique({
              where: { id: leaseId },
            });
            if (!lease) {
              return null;
            }
            if (lease.expiresAt <= now) {
              await tx.ttsRequestLease.deleteMany({ where: { id: leaseId } });
              return null;
            }
            const removed = await tx.ttsRequestLease.deleteMany({
              where: { id: leaseId, expiresAt: { gt: now } },
            });
            return removed.count === 1 ? lease : null;
          },
        };
        return fn(storeTx);
      });
    },
  };
}

let defaultStore: TtsUsageStore | null = null;

function getDefaultStore(): TtsUsageStore {
  if (!defaultStore) {
    defaultStore = createPrismaTtsUsageStore();
  }
  return defaultStore;
}

export type PaidTtsUsageDeps = {
  getSessionUserId?: () => Promise<string | null>;
  resolveEntitlement?: (callerUserId: string) => Promise<TtsEntitlementDecision>;
  store?: TtsUsageStore;
  prices?: BillingPriceConfiguration;
  synthesize?: (request: TtsSynthesisRequest) => Promise<SynthesizedAudio>;
  now?: () => Date;
};

// Loaded lazily so this module can be imported without initializing the full
// NextAuth stack; only a real request path resolves the session this way.
async function defaultGetSessionUserId(): Promise<string | null> {
  const [{ getServerSession }, { authOptions }] = await Promise.all([
    import("next-auth"),
    import("@/auth"),
  ]);
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  return typeof userId === "string" && userId !== "" ? userId : null;
}

/**
 * Authenticates the caller and resolves current Stage 1 entitlement plus
 * manual suspension. Runs before protected text resolution; the acquisition
 * transaction independently re-checks entitlement and suspension so nothing
 * here is cached as authorization.
 */
export async function authorizePaidTtsCaller(
  deps: PaidTtsUsageDeps = {}
): Promise<{ ok: true; access: PaidTtsAccess } | { ok: false; denial: TtsUsageDenial }> {
  let callerUserId: string | null;
  try {
    callerUserId = await (deps.getSessionUserId ?? defaultGetSessionUserId)();
  } catch (error) {
    console.error("[tts] session lookup unavailable", error);
    return { ok: false, denial: { reason: "unavailable" } };
  }
  if (!callerUserId) {
    return { ok: false, denial: { reason: "unauthenticated" } };
  }

  let entitlement: TtsEntitlementDecision;
  try {
    entitlement = await (deps.resolveEntitlement ?? resolveTtsEntitlement)(
      callerUserId
    );
  } catch (error) {
    console.error("[tts] entitlement lookup unavailable", error);
    return { ok: false, denial: { reason: "unavailable" } };
  }
  if (!entitlement.granted) {
    return { ok: false, denial: { reason: "forbidden" } };
  }

  return {
    ok: true,
    access: {
      callerUserId: entitlement.callerUserId,
      entitlementPrincipalUserId: entitlement.entitlementPrincipalUserId,
    },
  };
}

type AcquireInput = {
  access: PaidTtsAccess;
  provider: TtsUsageProviderName;
  requestKind: TtsUsageRequestKind;
  metrics: TtsInputMetrics;
};

type AcquireDecision =
  | { allowed: true; leaseId: string }
  | { allowed: false; denial: TtsUsageDenial };

/**
 * Atomically re-checks authorization and applies every emergency control
 * before a paid provider chunk may be dispatched. Runs entirely inside one
 * interactive transaction with caller/principal row locks so concurrent
 * requests cannot race past the burst, concurrency, or ten-hour boundaries.
 */
export async function acquirePaidTtsAttempt(
  input: AcquireInput,
  deps: Pick<PaidTtsUsageDeps, "store" | "prices" | "now"> = {}
): Promise<AcquireDecision> {
  const store = deps.store ?? getDefaultStore();
  const prices = deps.prices ?? readTtsBillingPrices();
  const now = deps.now?.() ?? new Date();
  const { callerUserId, entitlementPrincipalUserId } = input.access;

  const minuteStart = utcMinuteFloor(now);
  const dayStart = utcDayFloor(now);

  const callerDayKey: BucketKey = {
    subjectUserId: callerUserId,
    scope: "CALLER_DAY",
    windowStart: dayStart,
    provider: input.provider,
    requestKind: input.requestKind,
  };
  const principalDayKey: BucketKey = {
    subjectUserId: entitlementPrincipalUserId,
    scope: "ENTITLEMENT_DAY",
    windowStart: dayStart,
    provider: input.provider,
    requestKind: input.requestKind,
  };

  const recordRejection = async (
    tx: TtsUsageStoreTx,
    category: TtsRejectionCategory
  ) => {
    await tx.incrementRejection(callerDayKey, category);
    await tx.incrementRejection(principalDayKey, category);
  };

  try {
    return await store.transact(async (tx): Promise<AcquireDecision> => {
      await tx.lockEntitlementContext(callerUserId);

      // Derive the authoritative direct or inherited principal from locked
      // database state. The pre-transaction pair is only a claimed snapshot
      // and cannot grant access by itself.
      const caller = await tx.findUserForTts(callerUserId);
      if (!caller) {
        return { allowed: false, denial: { reason: "forbidden" } };
      }

      const directEntitlement = evaluateSubscriptionEntitlement({
        subscription: caller.subscription,
        prices,
        now,
      });
      let principal: TtsUserSnapshot;
      if (directEntitlement.granted) {
        if (entitlementPrincipalUserId !== callerUserId) {
          return { allowed: false, denial: { reason: "forbidden" } };
        }
        principal = caller;
      } else {
        if (caller.role !== "CHILD") {
          return { allowed: false, denial: { reason: "forbidden" } };
        }

        const linkedParents = await tx.findLinkedParentsForTts(callerUserId);
        const selectedParent = linkedParents.find((link) =>
          evaluateSubscriptionEntitlement({
            subscription: link.parent.subscription,
            prices,
            now,
          }).granted
        );
        if (
          !selectedParent ||
          selectedParent.parentId !== entitlementPrincipalUserId
        ) {
          return { allowed: false, denial: { reason: "forbidden" } };
        }
        principal = selectedParent.parent;
      }

      if (
        caller.ttsSuspendedAt !== null ||
        principal.ttsSuspendedAt !== null
      ) {
        return { allowed: false, denial: { reason: "forbidden" } };
      }

      await tx.deleteExpiredLeases(callerUserId, now);

      const minuteUsage = await tx.sumAcceptedUsage(
        callerUserId,
        "CALLER_MINUTE",
        minuteStart
      );
      if (minuteUsage.acceptedRequests + 1 > TTS_MAX_CALLER_ATTEMPTS_PER_MINUTE) {
        await recordRejection(tx, "burst");
        return {
          allowed: false,
          denial: {
            reason: "rate_limited",
            retryAfterSeconds: retryAfterSeconds(now, nextUtcMinuteStart(now)),
          },
        };
      }

      const activeLeases = await tx.countActiveLeases(callerUserId, now);
      if (activeLeases >= TTS_MAX_CONCURRENT_CALLER_LEASES) {
        await recordRejection(tx, "concurrency");
        const earliestExpiry = await tx.earliestActiveLeaseExpiry(
          callerUserId,
          now
        );
        return {
          allowed: false,
          denial: {
            reason: "rate_limited",
            retryAfterSeconds: retryAfterSeconds(
              now,
              earliestExpiry ?? new Date(now.getTime() + TTS_LEASE_DURATION_MS)
            ),
          },
        };
      }

      const dayUsage = await tx.sumAcceptedUsage(
        callerUserId,
        "CALLER_DAY",
        dayStart
      );
      if (dayUsage.acceptedWords + input.metrics.words > TTS_TEN_HOUR_CUTOFF_WORDS) {
        await tx.upsertAlert({
          callerUserId,
          entitlementPrincipalUserId,
          dayStart,
          kind: "TEN_HOUR_CUTOFF",
          observedWords: dayUsage.acceptedWords,
        });
        await recordRejection(tx, "extreme");
        return {
          allowed: false,
          denial: {
            reason: "rate_limited",
            retryAfterSeconds: retryAfterSeconds(now, nextUtcDayStart(now)),
          },
        };
      }

      const wordsAfter = dayUsage.acceptedWords + input.metrics.words;
      if (
        dayUsage.acceptedWords <= TTS_FIVE_HOUR_WARNING_WORDS &&
        wordsAfter > TTS_FIVE_HOUR_WARNING_WORDS
      ) {
        // Reporting-only: the request continues normally.
        await tx.upsertAlert({
          callerUserId,
          entitlementPrincipalUserId,
          dayStart,
          kind: "FIVE_HOUR_WARNING",
          observedWords: wordsAfter,
        });
      }

      const callerMinuteKey: BucketKey = {
        subjectUserId: callerUserId,
        scope: "CALLER_MINUTE",
        windowStart: minuteStart,
        provider: input.provider,
        requestKind: input.requestKind,
      };
      await tx.addAcceptedUsage(callerMinuteKey, input.metrics);
      await tx.addAcceptedUsage(callerDayKey, input.metrics);
      await tx.addAcceptedUsage(principalDayKey, input.metrics);

      const lease = await tx.createLease({
        callerUserId,
        entitlementPrincipalUserId,
        provider: input.provider,
        requestKind: input.requestKind,
        inputBytes: input.metrics.utf8Bytes,
        inputCharacters: input.metrics.characters,
        inputWords: input.metrics.words,
        callerMinuteStart: minuteStart,
        callerDayStart: dayStart,
        principalDayStart: dayStart,
        expiresAt: new Date(now.getTime() + TTS_LEASE_DURATION_MS),
      });

      return { allowed: true, leaseId: lease.id };
    });
  } catch (error) {
    console.error("[tts] usage acquisition unavailable", error);
    return { allowed: false, denial: { reason: "unavailable" } };
  }
}

function leaseBucketKeys(lease: TtsLeaseRecord): BucketKey[] {
  return [
    {
      subjectUserId: lease.callerUserId,
      scope: "CALLER_MINUTE",
      windowStart: lease.callerMinuteStart,
      provider: lease.provider,
      requestKind: lease.requestKind,
    },
    {
      subjectUserId: lease.callerUserId,
      scope: "CALLER_DAY",
      windowStart: lease.callerDayStart,
      provider: lease.provider,
      requestKind: lease.requestKind,
    },
    {
      subjectUserId: lease.entitlementPrincipalUserId,
      scope: "ENTITLEMENT_DAY",
      windowStart: lease.principalDayStart,
      provider: lease.provider,
      requestKind: lease.requestKind,
    },
  ];
}

async function completeLease(
  leaseId: string,
  counters: CompletionCounters,
  deps: Pick<PaidTtsUsageDeps, "store" | "now">
): Promise<TtsLeaseCompletionResult> {
  const store = deps.store ?? getDefaultStore();
  const now = deps.now?.() ?? new Date();
  return store.transact(async (tx) => {
    // Claiming deletes the exact lease exactly once, so duplicate or racing
    // completions cannot double-count. Missing and expired leases are not
    // evidence that this request finalized successfully.
    const lease = await tx.claimLease(leaseId, now);
    if (!lease) {
      return { finalized: false };
    }
    for (const key of leaseBucketKeys(lease)) {
      await tx.addCompletionUsage(key, counters);
    }
    return { finalized: true };
  });
}

export async function completePaidTtsSuccess(
  leaseId: string,
  generatedAudioBytes: number,
  deps: Pick<PaidTtsUsageDeps, "store" | "now"> = {}
): Promise<TtsLeaseCompletionResult> {
  return completeLease(
    leaseId,
    {
      successfulRequests: 1,
      failedRequests: 0,
      generatedAudioBytes: BigInt(generatedAudioBytes),
    },
    deps
  );
}

export async function completePaidTtsFailure(
  leaseId: string,
  deps: Pick<PaidTtsUsageDeps, "store" | "now"> = {}
): Promise<TtsLeaseCompletionResult> {
  return completeLease(
    leaseId,
    { successfulRequests: 0, failedRequests: 1, generatedAudioBytes: BigInt(0) },
    deps
  );
}

function providerNameFor(request: TtsSynthesisRequest): TtsUsageProviderName {
  return request.tts.provider === "google" ? "GOOGLE" : "LEMONFOX";
}

export type MeteredTtsSynthesisResult =
  | { status: "granted"; audio: SynthesizedAudio }
  | { status: "denied"; denial: TtsUsageDenial };

/**
 * Runs one already-authorized provider chunk through paid-attempt
 * acquisition, provider dispatch, and completion accounting. Provider and
 * accounting failures are thrown after the attempt is finalized so callers
 * keep the established 500/502/503 mapping. Accepted usage is never refunded
 * once the provider may have incurred cost.
 */
export async function runMeteredTtsSynthesis(
  request: TtsSynthesisRequest,
  requestKind: TtsUsageRequestKind,
  access: PaidTtsAccess,
  deps: PaidTtsUsageDeps = {}
): Promise<MeteredTtsSynthesisResult> {
  const metrics = measureTtsInput(request.text);
  if (metrics.utf8Bytes > TTS_MAX_PROVIDER_CHUNK_UTF8_BYTES) {
    // Request validation enforces this for public chunks; a server-resolved
    // protected text over the boundary is an internal content problem and
    // must fail without exposing the text.
    throw new TtsConfigurationError(
      request.tts.provider,
      "Synthesis text exceeded the provider chunk limit."
    );
  }

  // Future saved-audio cache seam: a later approved cache feature performs
  // its verified lookup here — after authentication, entitlement, suspension
  // checks, and secure text resolution, but before paid-attempt acquisition —
  // so a verified cache hit never creates a provider lease or paid counters.
  // Stage 3 stores no audio and implements no cache behavior.

  const acquisition = await acquirePaidTtsAttempt(
    {
      access,
      provider: providerNameFor(request),
      requestKind,
      metrics,
    },
    deps
  );
  if (!acquisition.allowed) {
    return { status: "denied", denial: acquisition.denial };
  }

  let audio: SynthesizedAudio;
  try {
    audio = await (deps.synthesize ?? synthesizeTts)(request);
  } catch (providerError) {
    try {
      const completion = await completePaidTtsFailure(
        acquisition.leaseId,
        deps
      );
      if (!completion.finalized) {
        throw new TtsUsageAccountingError("complete");
      }
    } catch (accountingError) {
      console.error("[tts] failure accounting unavailable", accountingError);
      if (accountingError instanceof TtsUsageAccountingError) {
        throw accountingError;
      }
      throw new TtsUsageAccountingError("complete");
    }
    throw providerError;
  }

  try {
    const completion = await completePaidTtsSuccess(
      acquisition.leaseId,
      audio.bytes.byteLength,
      deps
    );
    if (!completion.finalized) {
      throw new TtsUsageAccountingError("complete");
    }
  } catch (accountingError) {
    // Fail closed: unaccounted paid audio is never returned.
    console.error("[tts] success accounting unavailable", accountingError);
    throw new TtsUsageAccountingError("complete");
  }

  return { status: "granted", audio };
}

/**
 * Complete shared policy for one public provider chunk: authenticate,
 * resolve entitlement, then meter and dispatch.
 */
export async function runPaidTtsSynthesis(
  request: TtsSynthesisRequest,
  requestKind: TtsUsageRequestKind,
  deps: PaidTtsUsageDeps = {}
): Promise<MeteredTtsSynthesisResult> {
  const authorization = await authorizePaidTtsCaller(deps);
  if (!authorization.ok) {
    return { status: "denied", denial: authorization.denial };
  }
  return runMeteredTtsSynthesis(request, requestKind, authorization.access, deps);
}

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function jsonNoStore(status: number, message: string, headers?: Record<string, string>): Response {
  return Response.json(
    { error: message },
    { status, headers: { ...NO_STORE_HEADERS, ...headers } }
  );
}

/**
 * Translates a typed denial into the learner-safe HTTP contract. Bodies stay
 * generic: they never reveal entitlement source, suspension, warning/cutoff
 * state, usage totals, or internal identifiers.
 */
export function ttsDenialResponse(denial: TtsUsageDenial): Response {
  switch (denial.reason) {
    case "unauthenticated":
      return jsonNoStore(401, "Sign in to use text-to-speech.");
    case "forbidden":
      return jsonNoStore(403, "Text-to-speech is not available for this account.");
    case "rate_limited":
      return jsonNoStore(429, "Too many text-to-speech requests.", {
        "Retry-After": String(denial.retryAfterSeconds),
      });
    case "unavailable":
      return jsonNoStore(503, "The text-to-speech service is temporarily unavailable.");
  }
}

/**
 * Preserves the established provider failure mapping (500 configuration,
 * 502 upstream, 500 unexpected) and maps unconfirmed usage accounting to a
 * generic 503 without returning audio.
 */
export function paidTtsFailureResponse(error: unknown): Response {
  logTtsSynthesisError(error);

  if (error instanceof TtsUsageAccountingError) {
    return jsonNoStore(503, "The text-to-speech service is temporarily unavailable.");
  }
  if (error instanceof TtsConfigurationError) {
    return jsonNoStore(500, "The text-to-speech service is not configured.");
  }
  if (error instanceof TtsUpstreamError) {
    return jsonNoStore(502, "The text-to-speech provider is unavailable.");
  }
  return jsonNoStore(500, "An unexpected error occurred.");
}

export function paidTtsAudioResponse(audio: SynthesizedAudio): Response {
  // Uint8Array is a valid fetch BodyInit at runtime; this cast works around
  // a TS lib type-definition mismatch, not a real incompatibility.
  return new Response(audio.bytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": audio.contentType,
      "Cache-Control": "no-store",
    },
  });
}
