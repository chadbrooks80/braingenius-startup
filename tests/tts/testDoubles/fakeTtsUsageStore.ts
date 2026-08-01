import { randomUUID } from "node:crypto";
import type { EntitlementSubscription } from "../../../src/lib/billing/entitlement";
import type {
  TtsLeaseRecord,
  TtsUsageStore,
  TtsUsageStoreTx,
} from "../../../src/lib/learning-engine/speech/ttsUsageService";

type FakeTtsUser = {
  id: string;
  role: string | null;
  ttsSuspendedAt: Date | null;
  subscription: EntitlementSubscription | null;
};

export type FakeBucketRow = {
  subjectUserId: string;
  scope: "CALLER_MINUTE" | "CALLER_DAY" | "ENTITLEMENT_DAY";
  windowStart: Date;
  provider: "GOOGLE" | "LEMONFOX";
  requestKind: "PUBLIC_TEXT" | "PROTECTED_TEXT";
  acceptedRequests: number;
  acceptedInputBytes: number;
  acceptedInputCharacters: number;
  acceptedWords: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedBurst: number;
  rejectedConcurrency: number;
  rejectedExtremeUsage: number;
  generatedAudioBytes: bigint;
};

export type FakeAlertRow = {
  callerUserId: string;
  entitlementPrincipalUserId: string;
  dayStart: Date;
  kind: "FIVE_HOUR_WARNING" | "TEN_HOUR_CUTOFF";
  observedWords: number;
};

type TxOperation = keyof TtsUsageStoreTx | "transact";

function bucketKeyOf(row: {
  subjectUserId: string;
  scope: string;
  windowStart: Date;
  provider: string;
  requestKind: string;
}): string {
  return [
    row.subjectUserId,
    row.scope,
    row.windowStart.toISOString(),
    row.provider,
    row.requestKind,
  ].join("|");
}

/**
 * Deterministic in-memory TtsUsageStore with the same observable semantics
 * the production Prisma store relies on: per-user transaction locks that
 * serialize overlapping user sets (acquired in deduplicated ascending
 * order), an undo log so a failed transaction rolls back only its own
 * writes, unique bucket/alert rows, and delete-once lease claiming.
 */
export class FakeTtsUsageStore implements TtsUsageStore {
  private users = new Map<string, FakeTtsUser>();
  private buckets = new Map<string, FakeBucketRow>();
  private alerts = new Map<string, FakeAlertRow>();
  private leases = new Map<string, TtsLeaseRecord>();
  private parentLinks = new Set<string>();
  private activeLocks = new Map<string, Promise<void>>();
  private failOperations = new Set<TxOperation>();

  seedUser(user: {
    id: string;
    role?: string | null;
    ttsSuspendedAt?: Date | null;
    subscription?: EntitlementSubscription | null;
  }): void {
    this.users.set(user.id, {
      id: user.id,
      role: user.role ?? null,
      ttsSuspendedAt: user.ttsSuspendedAt ?? null,
      subscription: user.subscription ?? null,
    });
  }

  seedParentStudent(parentId: string, studentId: string): void {
    this.parentLinks.add(`${parentId}|${studentId}`);
  }

  removeParentStudent(parentId: string, studentId: string): void {
    this.parentLinks.delete(`${parentId}|${studentId}`);
  }

  setRole(userId: string, role: string | null): void {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`fakeTtsUsageStore: unknown user ${userId}`);
    }
    user.role = role;
  }

  setSuspension(userId: string, suspendedAt: Date | null): void {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`fakeTtsUsageStore: unknown user ${userId}`);
    }
    user.ttsSuspendedAt = suspendedAt;
  }

  /** Makes the next occurrence of the operation throw once. */
  failNext(operation: TxOperation): void {
    this.failOperations.add(operation);
  }

  getBuckets(): FakeBucketRow[] {
    return [...this.buckets.values()];
  }

  getBucket(
    key: Pick<
      FakeBucketRow,
      "subjectUserId" | "scope" | "windowStart" | "provider" | "requestKind"
    >
  ): FakeBucketRow | undefined {
    return this.buckets.get(bucketKeyOf(key));
  }

  getAlerts(): FakeAlertRow[] {
    return [...this.alerts.values()];
  }

  getLeases(): TtsLeaseRecord[] {
    return [...this.leases.values()];
  }

  private throwIfFailing(operation: TxOperation): void {
    if (this.failOperations.has(operation)) {
      this.failOperations.delete(operation);
      throw new Error(`fakeTtsUsageStore: simulated ${operation} failure`);
    }
  }

  private async acquireLocks(
    userIds: readonly string[],
    releases: (() => void)[]
  ): Promise<void> {
    const ordered = [...new Set(userIds)].sort();
    for (const userId of ordered) {
      while (this.activeLocks.has(userId)) {
        await this.activeLocks.get(userId);
      }
      let release!: () => void;
      const lockPromise = new Promise<void>((resolve) => {
        release = resolve;
      });
      this.activeLocks.set(userId, lockPromise);
      releases.push(() => {
        this.activeLocks.delete(userId);
        release();
      });
    }
  }

  async transact<T>(fn: (tx: TtsUsageStoreTx) => Promise<T>): Promise<T> {
    this.throwIfFailing("transact");

    const releases: (() => void)[] = [];
    const undoLog: (() => void)[] = [];
    const tx: TtsUsageStoreTx = {
      lockEntitlementContext: async (callerUserId) => {
        this.throwIfFailing("lockEntitlementContext");
        const parentIds = [...this.parentLinks]
          .map((link) => link.split("|"))
          .filter(([, studentId]) => studentId === callerUserId)
          .map(([parentId]) => parentId);
        await this.acquireLocks(
          [callerUserId, ...parentIds, `parent-links:${callerUserId}`],
          releases
        );
      },
      findUserForTts: async (userId) => {
        this.throwIfFailing("findUserForTts");
        const user = this.users.get(userId);
        return user
          ? {
              id: user.id,
              role: user.role,
              ttsSuspendedAt: user.ttsSuspendedAt,
              subscription: user.subscription,
            }
          : null;
      },
      findLinkedParentsForTts: async (studentId) => {
        this.throwIfFailing("findLinkedParentsForTts");
        return [...this.parentLinks]
          .map((link) => link.split("|"))
          .filter(([, linkedStudentId]) => linkedStudentId === studentId)
          .sort(([leftParentId], [rightParentId]) =>
            leftParentId.localeCompare(rightParentId)
          )
          .flatMap(([parentId]) => {
            const parent = this.users.get(parentId);
            return parent
              ? [
                  {
                    parentId,
                    parent: {
                      id: parent.id,
                      role: parent.role,
                      ttsSuspendedAt: parent.ttsSuspendedAt,
                      subscription: parent.subscription,
                    },
                  },
                ]
              : [];
          });
      },
      deleteExpiredLeases: async (callerUserId, now) => {
        this.throwIfFailing("deleteExpiredLeases");
        for (const [id, lease] of [...this.leases]) {
          if (lease.callerUserId === callerUserId && lease.expiresAt <= now) {
            this.leases.delete(id);
            undoLog.push(() => this.leases.set(id, lease));
          }
        }
      },
      countActiveLeases: async (callerUserId, now) => {
        this.throwIfFailing("countActiveLeases");
        return [...this.leases.values()].filter(
          (lease) => lease.callerUserId === callerUserId && lease.expiresAt > now
        ).length;
      },
      earliestActiveLeaseExpiry: async (callerUserId, now) => {
        this.throwIfFailing("earliestActiveLeaseExpiry");
        const expiries = [...this.leases.values()]
          .filter(
            (lease) => lease.callerUserId === callerUserId && lease.expiresAt > now
          )
          .map((lease) => lease.expiresAt.getTime())
          .sort((a, b) => a - b);
        return expiries.length > 0 ? new Date(expiries[0]) : null;
      },
      sumAcceptedUsage: async (subjectUserId, scope, windowStart) => {
        this.throwIfFailing("sumAcceptedUsage");
        let acceptedRequests = 0;
        let acceptedWords = 0;
        for (const bucket of this.buckets.values()) {
          if (
            bucket.subjectUserId === subjectUserId &&
            bucket.scope === scope &&
            bucket.windowStart.getTime() === windowStart.getTime()
          ) {
            acceptedRequests += bucket.acceptedRequests;
            acceptedWords += bucket.acceptedWords;
          }
        }
        return { acceptedRequests, acceptedWords };
      },
      upsertAlert: async (alert) => {
        this.throwIfFailing("upsertAlert");
        const key = `${alert.callerUserId}|${alert.dayStart.toISOString()}|${alert.kind}`;
        if (!this.alerts.has(key)) {
          this.alerts.set(key, { ...alert });
          undoLog.push(() => this.alerts.delete(key));
        }
      },
      incrementRejection: async (key, category) => {
        this.throwIfFailing("incrementRejection");
        const bucket = this.upsertBucket(key, undoLog);
        if (category === "burst") bucket.rejectedBurst += 1;
        else if (category === "concurrency") bucket.rejectedConcurrency += 1;
        else bucket.rejectedExtremeUsage += 1;
      },
      addAcceptedUsage: async (key, metrics) => {
        this.throwIfFailing("addAcceptedUsage");
        const bucket = this.upsertBucket(key, undoLog);
        bucket.acceptedRequests += 1;
        bucket.acceptedInputBytes += metrics.utf8Bytes;
        bucket.acceptedInputCharacters += metrics.characters;
        bucket.acceptedWords += metrics.words;
      },
      addCompletionUsage: async (key, counters) => {
        this.throwIfFailing("addCompletionUsage");
        const bucket = this.upsertBucket(key, undoLog);
        bucket.successfulRequests += counters.successfulRequests;
        bucket.failedRequests += counters.failedRequests;
        bucket.generatedAudioBytes += counters.generatedAudioBytes;
      },
      createLease: async (lease) => {
        this.throwIfFailing("createLease");
        const id = `lease-${randomUUID()}`;
        this.leases.set(id, { id, ...lease });
        undoLog.push(() => this.leases.delete(id));
        return { id };
      },
      claimLease: async (leaseId, now) => {
        this.throwIfFailing("claimLease");
        const lease = this.leases.get(leaseId);
        if (!lease) {
          return null;
        }
        if (lease.expiresAt <= now) {
          this.leases.delete(leaseId);
          undoLog.push(() => this.leases.set(leaseId, lease));
          return null;
        }
        this.leases.delete(leaseId);
        undoLog.push(() => this.leases.set(leaseId, lease));
        return lease;
      },
    };

    try {
      return await fn(tx);
    } catch (error) {
      for (let index = undoLog.length - 1; index >= 0; index -= 1) {
        undoLog[index]();
      }
      throw error;
    } finally {
      for (const release of releases) {
        release();
      }
    }
  }

  private upsertBucket(
    key: Pick<
      FakeBucketRow,
      "subjectUserId" | "scope" | "windowStart" | "provider" | "requestKind"
    >,
    undoLog: (() => void)[]
  ): FakeBucketRow {
    const mapKey = bucketKeyOf(key);
    const existing = this.buckets.get(mapKey);
    if (existing) {
      const snapshot = { ...existing };
      undoLog.push(() => this.buckets.set(mapKey, snapshot));
      return existing;
    }
    const created: FakeBucketRow = {
      ...key,
      acceptedRequests: 0,
      acceptedInputBytes: 0,
      acceptedInputCharacters: 0,
      acceptedWords: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedBurst: 0,
      rejectedConcurrency: 0,
      rejectedExtremeUsage: 0,
      generatedAudioBytes: BigInt(0),
    };
    this.buckets.set(mapKey, created);
    undoLog.push(() => this.buckets.delete(mapKey));
    return created;
  }
}

export const ADMIN_SUBSCRIPTION: EntitlementSubscription = {
  tier: "ADMIN",
  trialEndsAt: null,
  stripePriceId: null,
  stripeStatus: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};
