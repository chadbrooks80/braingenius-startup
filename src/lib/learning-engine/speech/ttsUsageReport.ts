import "server-only";
import prisma from "@/lib/db";
import {
  estimatedListeningHours,
  estimatedListeningMinutes,
  utcDayFloor,
} from "./ttsUsagePolicy";
import type {
  TtsUsageAlertKindName,
  TtsUsageProviderName,
  TtsUsageRequestKind,
  TtsUsageScopeName,
} from "./ttsUsageService";

// Server-only operational reporting for authorized abuse review. This module
// is intentionally not reachable from any browser or learner endpoint; it is
// invoked by authorized server-side operations only. It exposes exactly the
// identifiers needed for review plus numeric/temporal aggregates — never
// spoken text, canonical answers, audio, provider payloads, tokens, or raw
// errors.

type ReportScope = Extract<TtsUsageScopeName, "CALLER_DAY" | "ENTITLEMENT_DAY">;

export type TtsUsageReportRow = {
  subjectUserId: string;
  scope: ReportScope;
  dayStart: Date;
  provider: TtsUsageProviderName;
  requestKind: TtsUsageRequestKind;
  acceptedRequests: number;
  acceptedInputBytes: number;
  acceptedInputCharacters: number;
  acceptedWords: number;
  estimatedListeningMinutes: number;
  estimatedListeningHours: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedBurst: number;
  rejectedConcurrency: number;
  rejectedExtremeUsage: number;
  generatedAudioBytes: bigint;
};

export type TtsUsageReportAlert = {
  callerUserId: string;
  entitlementPrincipalUserId: string;
  dayStart: Date;
  kind: TtsUsageAlertKindName;
  observedWords: number;
  createdAt: Date;
};

export type TtsUsageDailyTotal = {
  subjectUserId: string;
  scope: ReportScope;
  dayStart: Date;
  acceptedRequests: number;
  acceptedInputBytes: number;
  acceptedInputCharacters: number;
  acceptedWords: number;
  estimatedListeningMinutes: number;
  estimatedListeningHours: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedBurst: number;
  rejectedConcurrency: number;
  rejectedExtremeUsage: number;
  generatedAudioBytes: bigint;
  fiveHourWarning: boolean;
  tenHourCutoff: boolean;
};

export type TtsUsageReport = {
  fromDayStart: Date;
  toDayStart: Date;
  rows: TtsUsageReportRow[];
  alerts: TtsUsageReportAlert[];
  dailyTotals: TtsUsageDailyTotal[];
};

type StoredBucketRow = Omit<
  TtsUsageReportRow,
  "dayStart" | "estimatedListeningMinutes" | "estimatedListeningHours" | "scope"
> & { windowStart: Date; scope: TtsUsageScopeName };

export type TtsUsageReportDb = {
  findDailyUsageBuckets(range: {
    fromDayStart: Date;
    toDayStart: Date;
  }): Promise<StoredBucketRow[]>;
  findUsageAlerts(range: {
    fromDayStart: Date;
    toDayStart: Date;
  }): Promise<TtsUsageReportAlert[]>;
};

const prismaReportDb: TtsUsageReportDb = {
  findDailyUsageBuckets({ fromDayStart, toDayStart }) {
    return prisma.ttsUsageBucket.findMany({
      where: {
        scope: { in: ["CALLER_DAY", "ENTITLEMENT_DAY"] },
        windowStart: { gte: fromDayStart, lte: toDayStart },
      },
      orderBy: [
        { windowStart: "asc" },
        { subjectUserId: "asc" },
        { provider: "asc" },
        { requestKind: "asc" },
      ],
      select: {
        subjectUserId: true,
        scope: true,
        windowStart: true,
        provider: true,
        requestKind: true,
        acceptedRequests: true,
        acceptedInputBytes: true,
        acceptedInputCharacters: true,
        acceptedWords: true,
        successfulRequests: true,
        failedRequests: true,
        rejectedBurst: true,
        rejectedConcurrency: true,
        rejectedExtremeUsage: true,
        generatedAudioBytes: true,
      },
    });
  },
  findUsageAlerts({ fromDayStart, toDayStart }) {
    return prisma.ttsUsageAlert.findMany({
      where: { dayStart: { gte: fromDayStart, lte: toDayStart } },
      orderBy: [{ dayStart: "asc" }, { callerUserId: "asc" }, { kind: "asc" }],
      select: {
        callerUserId: true,
        entitlementPrincipalUserId: true,
        dayStart: true,
        kind: true,
        observedWords: true,
        createdAt: true,
      },
    });
  },
};

export type TtsUsageReportDeps = {
  db?: TtsUsageReportDb;
};

/**
 * Aggregates one UTC day range by caller and entitlement principal.
 * Warning and cutoff alerts are joined onto the caller's daily totals so
 * they stand out during review.
 */
export async function getTtsUsageReport(
  range: { from: Date; to: Date },
  deps: TtsUsageReportDeps = {}
): Promise<TtsUsageReport> {
  const fromDayStart = utcDayFloor(range.from);
  const toDayStart = utcDayFloor(range.to);
  if (fromDayStart.getTime() > toDayStart.getTime()) {
    throw new Error("TTS usage report range is inverted.");
  }

  const db = deps.db ?? prismaReportDb;
  const [buckets, alerts] = await Promise.all([
    db.findDailyUsageBuckets({ fromDayStart, toDayStart }),
    db.findUsageAlerts({ fromDayStart, toDayStart }),
  ]);

  const rows: TtsUsageReportRow[] = [];
  for (const bucket of buckets) {
    // The query filters to day scopes; skipping anything else keeps the
    // narrowing honest instead of casting.
    if (bucket.scope !== "CALLER_DAY" && bucket.scope !== "ENTITLEMENT_DAY") {
      continue;
    }
    rows.push({
      subjectUserId: bucket.subjectUserId,
      scope: bucket.scope,
      dayStart: bucket.windowStart,
      provider: bucket.provider,
      requestKind: bucket.requestKind,
      acceptedRequests: bucket.acceptedRequests,
      acceptedInputBytes: bucket.acceptedInputBytes,
      acceptedInputCharacters: bucket.acceptedInputCharacters,
      acceptedWords: bucket.acceptedWords,
      estimatedListeningMinutes: estimatedListeningMinutes(bucket.acceptedWords),
      estimatedListeningHours: estimatedListeningHours(bucket.acceptedWords),
      successfulRequests: bucket.successfulRequests,
      failedRequests: bucket.failedRequests,
      rejectedBurst: bucket.rejectedBurst,
      rejectedConcurrency: bucket.rejectedConcurrency,
      rejectedExtremeUsage: bucket.rejectedExtremeUsage,
      generatedAudioBytes: bucket.generatedAudioBytes,
    });
  }

  const totals = new Map<string, TtsUsageDailyTotal>();
  for (const row of rows) {
    const key = `${row.scope}|${row.subjectUserId}|${row.dayStart.toISOString()}`;
    const existing = totals.get(key);
    if (!existing) {
      totals.set(key, {
        subjectUserId: row.subjectUserId,
        scope: row.scope,
        dayStart: row.dayStart,
        acceptedRequests: row.acceptedRequests,
        acceptedInputBytes: row.acceptedInputBytes,
        acceptedInputCharacters: row.acceptedInputCharacters,
        acceptedWords: row.acceptedWords,
        estimatedListeningMinutes: 0,
        estimatedListeningHours: 0,
        successfulRequests: row.successfulRequests,
        failedRequests: row.failedRequests,
        rejectedBurst: row.rejectedBurst,
        rejectedConcurrency: row.rejectedConcurrency,
        rejectedExtremeUsage: row.rejectedExtremeUsage,
        generatedAudioBytes: row.generatedAudioBytes,
        fiveHourWarning: false,
        tenHourCutoff: false,
      });
      continue;
    }
    existing.acceptedRequests += row.acceptedRequests;
    existing.acceptedInputBytes += row.acceptedInputBytes;
    existing.acceptedInputCharacters += row.acceptedInputCharacters;
    existing.acceptedWords += row.acceptedWords;
    existing.successfulRequests += row.successfulRequests;
    existing.failedRequests += row.failedRequests;
    existing.rejectedBurst += row.rejectedBurst;
    existing.rejectedConcurrency += row.rejectedConcurrency;
    existing.rejectedExtremeUsage += row.rejectedExtremeUsage;
    existing.generatedAudioBytes += row.generatedAudioBytes;
  }

  for (const total of totals.values()) {
    total.estimatedListeningMinutes = estimatedListeningMinutes(total.acceptedWords);
    total.estimatedListeningHours = estimatedListeningHours(total.acceptedWords);
  }

  for (const alert of alerts) {
    const key = `CALLER_DAY|${alert.callerUserId}|${alert.dayStart.toISOString()}`;
    const total = totals.get(key);
    if (total) {
      if (alert.kind === "FIVE_HOUR_WARNING") {
        total.fiveHourWarning = true;
      } else {
        total.tenHourCutoff = true;
      }
    }
  }

  return {
    fromDayStart,
    toDayStart,
    rows,
    alerts,
    dailyTotals: [...totals.values()],
  };
}
