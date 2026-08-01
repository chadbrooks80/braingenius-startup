import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getTtsUsageReport,
  type TtsUsageReportDb,
} from "../../src/lib/learning-engine/speech/ttsUsageReport";

const DAY = new Date("2026-07-29T00:00:00.000Z");
const NEXT_DAY = new Date("2026-07-30T00:00:00.000Z");

type BucketSeed = Awaited<
  ReturnType<TtsUsageReportDb["findDailyUsageBuckets"]>
>[number];

type AlertSeed = Awaited<ReturnType<TtsUsageReportDb["findUsageAlerts"]>>[number];

function bucket(overrides: Partial<BucketSeed>): BucketSeed {
  return {
    subjectUserId: "user-caller",
    scope: "CALLER_DAY",
    windowStart: DAY,
    provider: "GOOGLE",
    requestKind: "PUBLIC_TEXT",
    acceptedRequests: 10,
    acceptedInputBytes: 1_000,
    acceptedInputCharacters: 900,
    acceptedWords: 300,
    successfulRequests: 9,
    failedRequests: 1,
    rejectedBurst: 0,
    rejectedConcurrency: 0,
    rejectedExtremeUsage: 0,
    generatedAudioBytes: BigInt(50_000),
    ...overrides,
  };
}

function createDb(buckets: BucketSeed[], alerts: AlertSeed[]): TtsUsageReportDb {
  return {
    async findDailyUsageBuckets(range) {
      return buckets.filter(
        (row) =>
          row.windowStart >= range.fromDayStart && row.windowStart <= range.toDayStart
      );
    },
    async findUsageAlerts(range) {
      return alerts.filter(
        (alert) =>
          alert.dayStart >= range.fromDayStart && alert.dayStart <= range.toDayStart
      );
    },
  };
}

test("the report aggregates provider and request-kind rows into caller and principal daily totals with exact estimated listening time", async () => {
  const db = createDb(
    [
      bucket({ provider: "GOOGLE", requestKind: "PUBLIC_TEXT", acceptedWords: 30_000 }),
      bucket({
        provider: "LEMONFOX",
        requestKind: "PROTECTED_TEXT",
        acceptedWords: 15_000,
        rejectedBurst: 2,
      }),
      bucket({
        subjectUserId: "user-parent",
        scope: "ENTITLEMENT_DAY",
        acceptedWords: 45_000,
      }),
    ],
    []
  );

  const report = await getTtsUsageReport({ from: DAY, to: DAY }, { db });

  assert.equal(report.rows.length, 3);
  const callerTotal = report.dailyTotals.find(
    (total) => total.scope === "CALLER_DAY" && total.subjectUserId === "user-caller"
  );
  assert.ok(callerTotal);
  assert.equal(callerTotal.acceptedWords, 45_000);
  assert.equal(callerTotal.estimatedListeningMinutes, 300);
  assert.equal(callerTotal.estimatedListeningHours, 5);
  assert.equal(callerTotal.acceptedRequests, 20);
  assert.equal(callerTotal.successfulRequests, 18);
  assert.equal(callerTotal.failedRequests, 2);
  assert.equal(callerTotal.rejectedBurst, 2);
  assert.equal(callerTotal.generatedAudioBytes, BigInt(100_000));

  const principalTotal = report.dailyTotals.find(
    (total) => total.scope === "ENTITLEMENT_DAY"
  );
  assert.ok(principalTotal, "the entitlement principal aggregation is present");
  assert.equal(principalTotal.subjectUserId, "user-parent");
  assert.equal(principalTotal.estimatedListeningHours, 5);
});

test("five-hour warnings and ten-hour cutoffs appear prominently on the caller's daily totals", async () => {
  const db = createDb(
    [
      bucket({ acceptedWords: 46_000 }),
      bucket({ subjectUserId: "user-quiet", acceptedWords: 100 }),
    ],
    [
      {
        callerUserId: "user-caller",
        entitlementPrincipalUserId: "user-parent",
        dayStart: DAY,
        kind: "FIVE_HOUR_WARNING",
        observedWords: 45_001,
        createdAt: new Date("2026-07-29T10:00:00Z"),
      },
      {
        callerUserId: "user-caller",
        entitlementPrincipalUserId: "user-parent",
        dayStart: DAY,
        kind: "TEN_HOUR_CUTOFF",
        observedWords: 90_000,
        createdAt: new Date("2026-07-29T20:00:00Z"),
      },
    ]
  );

  const report = await getTtsUsageReport({ from: DAY, to: DAY }, { db });

  assert.equal(report.alerts.length, 2);
  const flagged = report.dailyTotals.find(
    (total) => total.subjectUserId === "user-caller"
  );
  assert.ok(flagged);
  assert.equal(flagged.fiveHourWarning, true);
  assert.equal(flagged.tenHourCutoff, true);

  const quiet = report.dailyTotals.find(
    (total) => total.subjectUserId === "user-quiet"
  );
  assert.ok(quiet);
  assert.equal(quiet.fiveHourWarning, false);
  assert.equal(quiet.tenHourCutoff, false);
});

test("the report range is inclusive of both UTC days and rejects an inverted range", async () => {
  const db = createDb(
    [bucket({ windowStart: DAY }), bucket({ windowStart: NEXT_DAY })],
    []
  );

  const inclusive = await getTtsUsageReport(
    { from: new Date("2026-07-29T13:45:00Z"), to: new Date("2026-07-30T02:10:00Z") },
    { db }
  );
  assert.equal(inclusive.rows.length, 2);

  await assert.rejects(() =>
    getTtsUsageReport({ from: NEXT_DAY, to: DAY }, { db })
  );
});

test("the report exposes only authorized identifiers and numeric/temporal aggregates", async () => {
  const db = createDb(
    [bucket({})],
    [
      {
        callerUserId: "user-caller",
        entitlementPrincipalUserId: "user-parent",
        dayStart: DAY,
        kind: "FIVE_HOUR_WARNING",
        observedWords: 45_001,
        createdAt: new Date("2026-07-29T10:00:00Z"),
      },
    ]
  );

  const report = await getTtsUsageReport({ from: DAY, to: DAY }, { db });

  assert.deepEqual(Object.keys(report.rows[0]).sort(), [
    "acceptedInputBytes",
    "acceptedInputCharacters",
    "acceptedRequests",
    "acceptedWords",
    "dayStart",
    "estimatedListeningHours",
    "estimatedListeningMinutes",
    "failedRequests",
    "generatedAudioBytes",
    "provider",
    "rejectedBurst",
    "rejectedConcurrency",
    "rejectedExtremeUsage",
    "requestKind",
    "scope",
    "subjectUserId",
    "successfulRequests",
  ]);
  assert.deepEqual(Object.keys(report.alerts[0]).sort(), [
    "callerUserId",
    "createdAt",
    "dayStart",
    "entitlementPrincipalUserId",
    "kind",
    "observedWords",
  ]);

  // No spoken text, audio, provider payloads, credentials, or session values
  // can appear: every value is an ID string, enum name, number, bigint, date,
  // or boolean.
  const values = [
    ...report.rows.flatMap((row) => Object.values(row)),
    ...report.alerts.flatMap((alert) => Object.values(alert)),
    ...report.dailyTotals.flatMap((total) => Object.values(total)),
  ];
  for (const value of values) {
    assert.ok(
      typeof value === "number" ||
        typeof value === "bigint" ||
        typeof value === "boolean" ||
        value instanceof Date ||
        (typeof value === "string" &&
          /^(user-[a-z-]+|CALLER_DAY|ENTITLEMENT_DAY|GOOGLE|LEMONFOX|PUBLIC_TEXT|PROTECTED_TEXT|FIVE_HOUR_WARNING|TEN_HOUR_CUTOFF)$/.test(
            value
          )),
      `unexpected report value: ${String(value)}`
    );
  }
});

test("caller-minute rows never leak into the daily report even if the query boundary regresses", async () => {
  const db = createDb(
    [bucket({}), bucket({ scope: "CALLER_MINUTE", windowStart: DAY })],
    []
  );

  const report = await getTtsUsageReport({ from: DAY, to: DAY }, { db });

  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].scope, "CALLER_DAY");
});
