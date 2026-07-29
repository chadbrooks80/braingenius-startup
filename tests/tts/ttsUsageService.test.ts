import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "../../src/lib/learning-engine/errors/TtsSynthesisError";
import {
  liftTtsSuspension,
  suspendTtsAccess,
  type TtsSuspensionDb,
} from "../../src/lib/learning-engine/speech/ttsAccessSuspension";
import {
  acquirePaidTtsAttempt,
  authorizePaidTtsCaller,
  completePaidTtsFailure,
  completePaidTtsSuccess,
  runMeteredTtsSynthesis,
  runPaidTtsSynthesis,
  TtsUsageAccountingError,
  type PaidTtsAccess,
  type TtsUsageStore,
} from "../../src/lib/learning-engine/speech/ttsUsageService";
import {
  measureTtsInput,
  type TtsInputMetrics,
} from "../../src/lib/learning-engine/speech/ttsUsagePolicy";
import type { TtsSynthesisRequest } from "../../src/lib/learning-engine/speech/validation/parseTtsSynthesisRequest";
import {
  ADMIN_SUBSCRIPTION,
  FakeTtsUsageStore,
} from "./testDoubles/fakeTtsUsageStore";

const PRICES = { monthly: "price_monthly", lifetime: "price_lifetime" };
const NOW = new Date("2026-07-29T10:30:30Z");
const MINUTE_START = new Date("2026-07-29T10:30:00Z");
const DAY_START = new Date("2026-07-29T00:00:00Z");
const CALLER = "user-caller";
const PARENT = "user-parent";
const FAKE_AUDIO = new Uint8Array([1, 2, 3, 4]);
const VALID_REQUEST: TtsSynthesisRequest = {
  text: "hello there",
  tts: { provider: "lemonfox", voice: "sarah" },
};

function metricsOfWords(words: number): TtsInputMetrics {
  return { utf8Bytes: words * 5, characters: words * 4, words };
}

function entitledStore(): FakeTtsUsageStore {
  const store = new FakeTtsUsageStore();
  store.seedUser({ id: CALLER, subscription: ADMIN_SUBSCRIPTION });
  return store;
}

function selfAccess(userId: string = CALLER): PaidTtsAccess {
  return { callerUserId: userId, entitlementPrincipalUserId: userId };
}

function acquireDeps(store: TtsUsageStore, now: Date = NOW) {
  return { store, prices: PRICES, now: () => now };
}

function seedInheritedAccess(
  store: FakeTtsUsageStore,
  childUserId: string,
  parentUserId: string = PARENT
): PaidTtsAccess {
  store.seedUser({
    id: parentUserId,
    role: "PARENT",
    subscription: ADMIN_SUBSCRIPTION,
  });
  store.seedUser({ id: childUserId, role: "CHILD", subscription: null });
  store.seedParentStudent(parentUserId, childUserId);
  return {
    callerUserId: childUserId,
    entitlementPrincipalUserId: parentUserId,
  };
}

async function seedAcceptedWords(
  store: FakeTtsUsageStore,
  words: number,
  options: {
    access?: PaidTtsAccess;
    provider?: "GOOGLE" | "LEMONFOX";
    requestKind?: "PUBLIC_TEXT" | "VOCABULARY_PROTECTED";
    now?: Date;
  } = {}
): Promise<string> {
  const decision = await acquirePaidTtsAttempt(
    {
      access: options.access ?? selfAccess(),
      provider: options.provider ?? "LEMONFOX",
      requestKind: options.requestKind ?? "PUBLIC_TEXT",
      metrics: metricsOfWords(words),
    },
    acquireDeps(store, options.now ?? NOW)
  );
  assert.ok(decision.allowed, `expected seed acquisition of ${words} words to be allowed`);
  return decision.leaseId;
}

test("an accepted attempt records exact usage in caller-minute, caller-day, and principal-day buckets and creates a 30-second lease", async () => {
  const store = entitledStore();
  const metrics = { utf8Bytes: 120, characters: 100, words: 20 };

  const decision = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "GOOGLE",
      requestKind: "PUBLIC_TEXT",
      metrics,
    },
    acquireDeps(store)
  );

  assert.ok(decision.allowed);
  const leases = store.getLeases();
  assert.equal(leases.length, 1);
  assert.equal(leases[0].expiresAt.getTime(), NOW.getTime() + 30_000);
  assert.equal(leases[0].inputWords, 20);

  for (const [scope, windowStart, subject] of [
    ["CALLER_MINUTE", MINUTE_START, CALLER],
    ["CALLER_DAY", DAY_START, CALLER],
    ["ENTITLEMENT_DAY", DAY_START, CALLER],
  ] as const) {
    const bucket = store.getBucket({
      subjectUserId: subject,
      scope,
      windowStart,
      provider: "GOOGLE",
      requestKind: "PUBLIC_TEXT",
    });
    assert.ok(bucket, `${scope} bucket must exist`);
    assert.equal(bucket.acceptedRequests, 1);
    assert.equal(bucket.acceptedInputBytes, 120);
    assert.equal(bucket.acceptedInputCharacters, 100);
    assert.equal(bucket.acceptedWords, 20);
  }
});

test("exactly 45,000 accepted caller words stays normal and produces no warning", async () => {
  const store = entitledStore();
  await seedAcceptedWords(store, 44_000);
  await seedAcceptedWords(store, 1_000);

  assert.deepEqual(store.getAlerts(), []);
});

test("crossing above 45,000 words is accepted and creates exactly one durable five-hour warning", async () => {
  const store = entitledStore();
  await seedAcceptedWords(store, 45_000);
  await seedAcceptedWords(store, 1);

  const alerts = store.getAlerts();
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].kind, "FIVE_HOUR_WARNING");
  assert.equal(alerts[0].callerUserId, CALLER);
  assert.equal(alerts[0].observedWords, 45_001);

  // Further accepted requests that day do not duplicate the warning.
  await seedAcceptedWords(store, 100);
  assert.equal(store.getAlerts().length, 1);
});

test("exactly 90,000 caller words is accepted; a request that would reach 90,001 is rejected once with a next-day Retry-After and one cutoff alert", async () => {
  const store = entitledStore();
  await seedAcceptedWords(store, 45_000);
  await seedAcceptedWords(store, 45_000);

  const rejected = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );

  assert.ok(!rejected.allowed);
  assert.deepEqual(rejected.denial, {
    reason: "rate_limited",
    // 2026-07-30T00:00:00Z minus 2026-07-29T10:30:30Z.
    retryAfterSeconds: 13 * 3600 + 29 * 60 + 30,
  });

  const cutoffs = store.getAlerts().filter((alert) => alert.kind === "TEN_HOUR_CUTOFF");
  assert.equal(cutoffs.length, 1);
  assert.equal(cutoffs[0].observedWords, 90_000);

  // Only the emergency cutoff alerted; usage stayed at 90,000 words and the
  // rejection was counted in the bounded aggregate counter.
  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: DAY_START,
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.acceptedWords, 90_000);
  assert.equal(dayBucket.rejectedExtremeUsage, 1);
  assert.equal(store.getLeases().length, 2, "no lease is created for the rejection");

  // A repeat attempt rejects again without duplicating the alert row.
  const repeated = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );
  assert.ok(!repeated.allowed);
  assert.equal(
    store.getAlerts().filter((alert) => alert.kind === "TEN_HOUR_CUTOFF").length,
    1
  );
});

test("provider and public/protected usage sum into the same caller-day word total for cutoff enforcement", async () => {
  const store = entitledStore();
  await seedAcceptedWords(store, 60_000, { provider: "GOOGLE", requestKind: "PUBLIC_TEXT" });
  await seedAcceptedWords(store, 30_000, {
    provider: "LEMONFOX",
    requestKind: "VOCABULARY_PROTECTED",
  });

  const rejected = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "GOOGLE",
      requestKind: "VOCABULARY_PROTECTED",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );
  assert.ok(!rejected.allowed);
  assert.equal(rejected.denial.reason, "rate_limited");
});

test("high request and byte totals below the word cutoff are not denied; there is no normal daily request or byte cap", async () => {
  const store = entitledStore();
  let clock = new Date("2026-07-29T00:00:00Z");

  // 500 accepted requests with large byte counts across the day — far above
  // the removed 300-request/100,000-byte style caps — all accepted because
  // only burst, concurrency, and the word thresholds may deny.
  for (let index = 0; index < 500; index += 1) {
    clock = new Date(clock.getTime() + 30_000);
    const decision = await acquirePaidTtsAttempt(
      {
        access: selfAccess(),
        provider: "LEMONFOX",
        requestKind: "PUBLIC_TEXT",
        metrics: { utf8Bytes: 4_900, characters: 4_800, words: 10 },
      },
      acquireDeps(store, clock)
    );
    assert.ok(decision.allowed, `request ${index + 1} must be accepted`);
  }
});

test("the 121st accepted caller attempt in one fixed UTC minute is rejected with a next-minute Retry-After", async () => {
  const store = entitledStore();
  for (let index = 0; index < 120; index += 1) {
    // Completing each attempt frees its concurrency lease; the accepted
    // per-minute attempt count is unaffected by completion.
    const leaseId = await seedAcceptedWords(store, 1);
    await completePaidTtsSuccess(leaseId, 1, acquireDeps(store));
  }

  const rejected = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );

  assert.ok(!rejected.allowed);
  assert.deepEqual(rejected.denial, { reason: "rate_limited", retryAfterSeconds: 30 });
  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: DAY_START,
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.rejectedBurst, 1);

  // The next fixed UTC minute accepts again.
  const nextMinute = new Date("2026-07-29T10:31:00Z");
  const accepted = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store, nextMinute)
  );
  assert.ok(accepted.allowed);
});

test("an eleventh unexpired concurrent lease is rejected with the earliest lease expiry as Retry-After, and expiry frees the slot", async () => {
  const store = entitledStore();
  for (let index = 0; index < 10; index += 1) {
    await seedAcceptedWords(store, 1);
  }
  assert.equal(store.getLeases().length, 10);

  const rejected = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );
  assert.ok(!rejected.allowed);
  assert.deepEqual(rejected.denial, { reason: "rate_limited", retryAfterSeconds: 30 });

  // After the leases expire, an acquisition in the same minute would still
  // hit the burst window, so advance past both boundaries and accept.
  const later = new Date(NOW.getTime() + 31_000);
  const accepted = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store, later)
  );
  assert.ok(accepted.allowed);
  assert.equal(
    store.getLeases().filter((lease) => lease.expiresAt <= later).length,
    0,
    "expired leases are cleaned during acquisition"
  );
});

test("ten simultaneous requests may hold leases while the eleventh is rejected, without racing", async () => {
  const store = entitledStore();

  const decisions = await Promise.all(
    Array.from({ length: 11 }, () =>
      acquirePaidTtsAttempt(
        {
          access: selfAccess(),
          provider: "LEMONFOX",
          requestKind: "PUBLIC_TEXT",
          metrics: metricsOfWords(1),
        },
        acquireDeps(store)
      )
    )
  );

  const allowed = decisions.filter((decision) => decision.allowed);
  assert.equal(allowed.length, 10);
  assert.equal(store.getLeases().length, 10);
});

test("a still-running provider attempt retains its lease in the ten-attempt concurrency guard until finalization", async (t) => {
  const store = entitledStore();
  let releaseProvider!: () => void;
  const providerGate = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  t.after(() => releaseProvider());
  let markProviderStarted!: () => void;
  const providerStarted = new Promise<void>((resolve) => {
    markProviderStarted = resolve;
  });

  const running = runMeteredTtsSynthesis(
    VALID_REQUEST,
    "PUBLIC_TEXT",
    selfAccess(),
    {
      ...acquireDeps(store),
      synthesize: async () => {
        markProviderStarted();
        await providerGate;
        return { bytes: FAKE_AUDIO, contentType: "audio/mpeg" };
      },
    }
  );
  await providerStarted;
  assert.equal(store.getLeases().length, 1);

  for (let index = 0; index < 9; index += 1) {
    await seedAcceptedWords(store, 1);
  }
  const eleventh = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );
  assert.ok(!eleventh.allowed);
  assert.equal(eleventh.denial.reason, "rate_limited");
  assert.equal(store.getLeases().length, 10);

  releaseProvider();
  const completed = await running;
  assert.equal(completed.status, "granted");
  assert.equal(
    store.getLeases().length,
    9,
    "only the finalized provider attempt releases its exact lease"
  );
});

test("concurrent acquisition cannot race past the ten-hour word boundary", async () => {
  const store = entitledStore();
  await seedAcceptedWords(store, 89_998);

  const decisions = await Promise.all(
    Array.from({ length: 5 }, () =>
      acquirePaidTtsAttempt(
        {
          access: selfAccess(),
          provider: "LEMONFOX",
          requestKind: "PUBLIC_TEXT",
          metrics: metricsOfWords(1),
        },
        acquireDeps(store)
      )
    )
  );

  assert.equal(decisions.filter((decision) => decision.allowed).length, 2);
  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: DAY_START,
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.acceptedWords, 90_000);
});

test("concurrent warning-threshold crossings create at most one five-hour alert", async () => {
  const store = entitledStore();
  await seedAcceptedWords(store, 44_999);

  await Promise.all(
    Array.from({ length: 4 }, () =>
      acquirePaidTtsAttempt(
        {
          access: selfAccess(),
          provider: "LEMONFOX",
          requestKind: "PUBLIC_TEXT",
          metrics: metricsOfWords(2),
        },
        acquireDeps(store)
      )
    )
  );

  assert.equal(
    store.getAlerts().filter((alert) => alert.kind === "FIVE_HOUR_WARNING").length,
    1
  );
});

test("a request immediately before UTC midnight uses the old day and a request exactly at midnight uses the new day", async () => {
  const store = entitledStore();
  const beforeMidnight = new Date("2026-07-29T23:59:59.999Z");
  const atMidnight = new Date("2026-07-30T00:00:00.000Z");

  await seedAcceptedWords(store, 90_000, { now: beforeMidnight });

  const stillOldDay = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store, beforeMidnight)
  );
  assert.ok(!stillOldDay.allowed, "the old day is already at the cutoff");

  const newDay = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store, atMidnight)
  );
  assert.ok(newDay.allowed, "the new UTC day starts a fresh word total");
});

test("parent and child keep independent caller thresholds while aggregating into the same principal report totals", async () => {
  const store = new FakeTtsUsageStore();
  const childA = seedInheritedAccess(store, "user-child-a");
  store.seedUser({ id: "user-child-b", role: "CHILD", subscription: null });
  store.seedParentStudent(PARENT, "user-child-b");
  const childB: PaidTtsAccess = {
    callerUserId: "user-child-b",
    entitlementPrincipalUserId: PARENT,
  };

  await seedAcceptedWords(store, 90_000, { access: childA });

  const childACutOff = await acquirePaidTtsAttempt(
    {
      access: childA,
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );
  assert.ok(!childACutOff.allowed, "child A crossed its own caller threshold");

  const childBAccepted = await acquirePaidTtsAttempt(
    {
      access: childB,
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(10),
    },
    acquireDeps(store)
  );
  assert.ok(childBAccepted.allowed, "child B keeps an independent caller threshold");

  const principalBucket = store.getBucket({
    subjectUserId: PARENT,
    scope: "ENTITLEMENT_DAY",
    windowStart: DAY_START,
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(principalBucket);
  assert.equal(
    principalBucket.acceptedWords,
    90_010,
    "principal-day reporting aggregates both children"
  );
});

test("concurrent parent and child acquisitions with overlapping locks complete without deadlock", async () => {
  const store = new FakeTtsUsageStore();
  const childAccess = seedInheritedAccess(store, "user-child-a");

  const decisions = await Promise.all([
    acquirePaidTtsAttempt(
      {
        access: childAccess,
        provider: "LEMONFOX",
        requestKind: "PUBLIC_TEXT",
        metrics: metricsOfWords(1),
      },
      acquireDeps(store)
    ),
    acquirePaidTtsAttempt(
      {
        access: selfAccess(PARENT),
        provider: "LEMONFOX",
        requestKind: "PUBLIC_TEXT",
        metrics: metricsOfWords(1),
      },
      acquireDeps(store)
    ),
  ]);

  assert.ok(decisions.every((decision) => decision.allowed));
});

test("a suspended caller or suspended entitlement principal is denied inside the acquisition transaction without creating usage", async () => {
  const store = new FakeTtsUsageStore();
  const childAccess = seedInheritedAccess(store, "user-child-a");

  store.setSuspension("user-child-a", NOW);
  const suspendedCaller = await acquirePaidTtsAttempt(
    {
      access: childAccess,
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );
  assert.ok(!suspendedCaller.allowed);
  assert.equal(suspendedCaller.denial.reason, "forbidden");

  store.setSuspension("user-child-a", null);
  store.setSuspension(PARENT, NOW);
  const suspendedPrincipal = await acquirePaidTtsAttempt(
    {
      access: childAccess,
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );
  assert.ok(!suspendedPrincipal.allowed);
  assert.equal(suspendedPrincipal.denial.reason, "forbidden");

  assert.deepEqual(store.getBuckets(), []);
  assert.deepEqual(store.getLeases(), []);
});

test("removing an inherited parent link after authorization denies acquisition without usage, alert, or lease creation", async () => {
  const store = new FakeTtsUsageStore();
  const childAccess = seedInheritedAccess(store, "user-child-a");
  store.removeParentStudent(PARENT, "user-child-a");

  const decision = await acquirePaidTtsAttempt(
    {
      access: childAccess,
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );

  assert.ok(!decision.allowed);
  assert.equal(decision.denial.reason, "forbidden");
  assert.deepEqual(store.getBuckets(), []);
  assert.deepEqual(store.getAlerts(), []);
  assert.deepEqual(store.getLeases(), []);
});

test("changing an inherited caller away from CHILD before acquisition denies without paid side effects", async () => {
  const store = new FakeTtsUsageStore();
  const childAccess = seedInheritedAccess(store, "user-child-a");
  store.setRole("user-child-a", "STUDENT");

  const decision = await acquirePaidTtsAttempt(
    {
      access: childAccess,
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );

  assert.ok(!decision.allowed);
  assert.equal(decision.denial.reason, "forbidden");
  assert.deepEqual(store.getBuckets(), []);
  assert.deepEqual(store.getAlerts(), []);
  assert.deepEqual(store.getLeases(), []);
});

test("an arbitrary or stale principal pair cannot grant inherited access", async () => {
  const store = new FakeTtsUsageStore();
  seedInheritedAccess(store, "user-child-a");
  store.seedUser({
    id: "user-arbitrary-parent",
    role: "PARENT",
    subscription: ADMIN_SUBSCRIPTION,
  });

  const decision = await acquirePaidTtsAttempt(
    {
      access: {
        callerUserId: "user-child-a",
        entitlementPrincipalUserId: "user-arbitrary-parent",
      },
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );

  assert.ok(!decision.allowed);
  assert.equal(decision.denial.reason, "forbidden");
  assert.deepEqual(store.getBuckets(), []);
  assert.deepEqual(store.getLeases(), []);
});

test("a transactional parent-relationship read failure denies unavailable before paid side effects", async () => {
  const store = new FakeTtsUsageStore();
  const childAccess = seedInheritedAccess(store, "user-child-a");
  store.failNext("findLinkedParentsForTts");

  const decision = await acquirePaidTtsAttempt(
    {
      access: childAccess,
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );

  assert.ok(!decision.allowed);
  assert.equal(decision.denial.reason, "unavailable");
  assert.deepEqual(store.getBuckets(), []);
  assert.deepEqual(store.getAlerts(), []);
  assert.deepEqual(store.getLeases(), []);
});

test("transactional inheritance preserves stable first-entitled-parent selection", async () => {
  const store = new FakeTtsUsageStore();
  store.seedUser({ id: "parent-a", role: "PARENT", subscription: null });
  store.seedUser({
    id: "parent-b",
    role: "PARENT",
    subscription: ADMIN_SUBSCRIPTION,
  });
  store.seedUser({
    id: "parent-c",
    role: "PARENT",
    subscription: ADMIN_SUBSCRIPTION,
  });
  store.seedUser({ id: "user-child-a", role: "CHILD", subscription: null });
  store.seedParentStudent("parent-c", "user-child-a");
  store.seedParentStudent("parent-a", "user-child-a");
  store.seedParentStudent("parent-b", "user-child-a");

  const selected = await acquirePaidTtsAttempt(
    {
      access: {
        callerUserId: "user-child-a",
        entitlementPrincipalUserId: "parent-b",
      },
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );
  assert.ok(selected.allowed);

  const skippedFirstEntitled = await acquirePaidTtsAttempt(
    {
      access: {
        callerUserId: "user-child-a",
        entitlementPrincipalUserId: "parent-c",
      },
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );
  assert.ok(!skippedFirstEntitled.allowed);
  assert.equal(skippedFirstEntitled.denial.reason, "forbidden");
});

test("entitlement that lapsed between authorization and acquisition is denied inside the transaction", async () => {
  const store = new FakeTtsUsageStore();
  store.seedUser({
    id: CALLER,
    subscription: {
      tier: "FREE_TRIAL",
      trialEndsAt: new Date(NOW.getTime() - 1),
      stripePriceId: null,
      stripeStatus: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  });

  const decision = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );
  assert.ok(!decision.allowed);
  assert.equal(decision.denial.reason, "forbidden");
  assert.deepEqual(store.getBuckets(), []);
});

test("a session user missing from the usage database is denied without usage rows", async () => {
  const store = new FakeTtsUsageStore();

  const decision = await acquirePaidTtsAttempt(
    {
      access: selfAccess("user-ghost"),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(1),
    },
    acquireDeps(store)
  );
  assert.ok(!decision.allowed);
  assert.equal(decision.denial.reason, "forbidden");
  assert.deepEqual(store.getBuckets(), []);
});

test("a database failure during acquisition denies as unavailable and never dispatches the provider", async () => {
  const store = entitledStore();
  store.failNext("transact");
  let synthesizeCalls = 0;

  const result = await runMeteredTtsSynthesis(
    VALID_REQUEST,
    "PUBLIC_TEXT",
    selfAccess(),
    {
      ...acquireDeps(store),
      synthesize: async () => {
        synthesizeCalls += 1;
        return { bytes: FAKE_AUDIO, contentType: "audio/mpeg" };
      },
    }
  );

  assert.deepEqual(result, {
    status: "denied",
    denial: { reason: "unavailable" },
  });
  assert.equal(synthesizeCalls, 0);
});

test("success completion claims the exact lease once and records output bytes without double-counting on duplicate completion", async () => {
  const store = entitledStore();
  const leaseId = await seedAcceptedWords(store, 5);

  const first = await completePaidTtsSuccess(
    leaseId,
    4321,
    acquireDeps(store)
  );
  const duplicate = await completePaidTtsSuccess(
    leaseId,
    4321,
    acquireDeps(store)
  );
  assert.deepEqual(first, { finalized: true });
  assert.deepEqual(duplicate, { finalized: false });

  assert.equal(store.getLeases().length, 0);
  for (const scope of ["CALLER_MINUTE", "CALLER_DAY", "ENTITLEMENT_DAY"] as const) {
    const bucket = store.getBucket({
      subjectUserId: CALLER,
      scope,
      windowStart: scope === "CALLER_MINUTE" ? MINUTE_START : DAY_START,
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
    });
    assert.ok(bucket);
    assert.equal(bucket.successfulRequests, 1);
    assert.equal(bucket.generatedAudioBytes, BigInt(4321));
    assert.equal(bucket.failedRequests, 0);
  }
});

test("failure completion releases only its exact lease and increments failure once while accepted usage remains counted", async () => {
  const store = entitledStore();
  const leaseId = await seedAcceptedWords(store, 5);
  const otherLeaseId = await seedAcceptedWords(store, 5);

  const first = await completePaidTtsFailure(leaseId, acquireDeps(store));
  const duplicate = await completePaidTtsFailure(
    leaseId,
    acquireDeps(store)
  );
  assert.deepEqual(first, { finalized: true });
  assert.deepEqual(duplicate, { finalized: false });

  assert.deepEqual(
    store.getLeases().map((lease) => lease.id),
    [otherLeaseId],
    "only the exact completed lease is released"
  );
  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: DAY_START,
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.failedRequests, 1);
  assert.equal(dayBucket.acceptedWords, 10, "accepted usage is never refunded");
});

test("provider failure still consumes accepted usage: the error is rethrown after failure accounting", async () => {
  const store = entitledStore();

  await assert.rejects(
    () =>
      runMeteredTtsSynthesis(VALID_REQUEST, "PUBLIC_TEXT", selfAccess(), {
        ...acquireDeps(store),
        synthesize: async () => {
          throw new TtsUpstreamError("lemonfox", "upstream rejected");
        },
      }),
    TtsUpstreamError
  );

  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: DAY_START,
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.acceptedRequests, 1);
  assert.equal(dayBucket.failedRequests, 1);
  assert.equal(store.getLeases().length, 0, "the lease is released");
});

test("audio is never returned when success accounting fails: the caller sees an accounting error instead", async () => {
  const store = entitledStore();

  await assert.rejects(
    () =>
      runMeteredTtsSynthesis(VALID_REQUEST, "PUBLIC_TEXT", selfAccess(), {
        ...acquireDeps(store),
        synthesize: async () => {
          store.failNext("transact");
          return { bytes: FAKE_AUDIO, contentType: "audio/mpeg" };
        },
      }),
    TtsUsageAccountingError
  );
});

test("audio is never returned when the exact success lease has expired before completion", async () => {
  const store = entitledStore();
  let clockReads = 0;

  await assert.rejects(
    () =>
      runMeteredTtsSynthesis(VALID_REQUEST, "PUBLIC_TEXT", selfAccess(), {
        store,
        prices: PRICES,
        now: () => {
          clockReads += 1;
          return clockReads === 1
            ? NOW
            : new Date(NOW.getTime() + 31_000);
        },
        synthesize: async () => ({
          bytes: FAKE_AUDIO,
          contentType: "audio/mpeg",
        }),
      }),
    TtsUsageAccountingError
  );

  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: DAY_START,
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.acceptedRequests, 1);
  assert.equal(dayBucket.successfulRequests, 0);
  assert.equal(dayBucket.generatedAudioBytes, BigInt(0));
  assert.deepEqual(store.getLeases(), []);
});

test("an unconfirmed failure completion maps to accounting unavailable instead of the provider error", async () => {
  const store = entitledStore();
  let clockReads = 0;

  await assert.rejects(
    () =>
      runMeteredTtsSynthesis(VALID_REQUEST, "PUBLIC_TEXT", selfAccess(), {
        store,
        prices: PRICES,
        now: () => {
          clockReads += 1;
          return clockReads === 1
            ? NOW
            : new Date(NOW.getTime() + 31_000);
        },
        synthesize: async () => {
          throw new TtsUpstreamError("lemonfox", "upstream failed");
        },
      }),
    TtsUsageAccountingError
  );

  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: DAY_START,
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.acceptedRequests, 1);
  assert.equal(dayBucket.failedRequests, 0);
});

test("an expired lease no longer blocks acquisition and its accepted usage stays counted after the crash", async () => {
  const store = entitledStore();
  for (let index = 0; index < 10; index += 1) {
    await seedAcceptedWords(store, 3);
  }

  // Simulates a crashed invocation: no completion ever runs, the leases just
  // expire. Later acquisition cleans them and proceeds.
  const later = new Date(NOW.getTime() + 31_000);
  const accepted = await acquirePaidTtsAttempt(
    {
      access: selfAccess(),
      provider: "LEMONFOX",
      requestKind: "PUBLIC_TEXT",
      metrics: metricsOfWords(3),
    },
    acquireDeps(store, later)
  );
  assert.ok(accepted.allowed);

  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: DAY_START,
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.acceptedWords, 33, "crashed attempts remain in accepted usage");
});

test("a server-resolved protected text over 5,000 UTF-8 bytes fails as an internal configuration error before any paid attempt", async () => {
  const store = entitledStore();
  let synthesizeCalls = 0;

  await assert.rejects(
    () =>
      runMeteredTtsSynthesis(
        { text: "long ".repeat(1_500), tts: { provider: "lemonfox", voice: "sarah" } },
        "VOCABULARY_PROTECTED",
        selfAccess(),
        {
          ...acquireDeps(store),
          synthesize: async () => {
            synthesizeCalls += 1;
            return { bytes: FAKE_AUDIO, contentType: "audio/mpeg" };
          },
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof TtsConfigurationError);
      assert.ok(!error.message.includes("long"), "the text never appears in the error");
      return true;
    }
  );

  assert.equal(synthesizeCalls, 0);
  assert.deepEqual(store.getBuckets(), []);
  assert.deepEqual(store.getLeases(), []);
});

test("authorizePaidTtsCaller returns unauthenticated for a missing session, forbidden for denied entitlement, and unavailable for boundary failures", async () => {
  const anonymous = await authorizePaidTtsCaller({
    getSessionUserId: async () => null,
  });
  assert.deepEqual(anonymous, {
    ok: false,
    denial: { reason: "unauthenticated" },
  });

  const denied = await authorizePaidTtsCaller({
    getSessionUserId: async () => CALLER,
    resolveEntitlement: async () => ({ granted: false }),
  });
  assert.deepEqual(denied, { ok: false, denial: { reason: "forbidden" } });

  const sessionFailure = await authorizePaidTtsCaller({
    getSessionUserId: async () => {
      throw new Error("session store down");
    },
  });
  assert.deepEqual(sessionFailure, {
    ok: false,
    denial: { reason: "unavailable" },
  });

  const entitlementFailure = await authorizePaidTtsCaller({
    getSessionUserId: async () => CALLER,
    resolveEntitlement: async () => {
      throw new Error("database down");
    },
  });
  assert.deepEqual(entitlementFailure, {
    ok: false,
    denial: { reason: "unavailable" },
  });
});

test("runPaidTtsSynthesis grants audio for an authorized caller and records the complete accepted/success usage", async () => {
  const store = entitledStore();

  const result = await runPaidTtsSynthesis(VALID_REQUEST, "PUBLIC_TEXT", {
    getSessionUserId: async () => CALLER,
    resolveEntitlement: async () => ({
      granted: true,
      callerUserId: CALLER,
      entitlementPrincipalUserId: CALLER,
      source: "administrative",
    }),
    ...acquireDeps(store),
    synthesize: async () => ({ bytes: FAKE_AUDIO, contentType: "audio/mpeg" }),
  });

  assert.equal(result.status, "granted");
  const expected = measureTtsInput(VALID_REQUEST.text);
  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: DAY_START,
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.acceptedWords, expected.words);
  assert.equal(dayBucket.successfulRequests, 1);
  assert.equal(dayBucket.generatedAudioBytes, BigInt(FAKE_AUDIO.byteLength));
});

test("manual suspension writes and lifts through the narrow boundary and rejects malformed reason codes and unknown users", async () => {
  const updates: Array<{
    userId: string;
    state: { ttsSuspendedAt: Date | null; ttsSuspensionReasonCode: string | null };
  }> = [];
  const knownUsers = new Set([CALLER]);
  const fakeDb: TtsSuspensionDb = {
    async setTtsSuspension(userId, state) {
      updates.push({ userId, state });
      return { count: knownUsers.has(userId) ? 1 : 0 };
    },
  };

  await suspendTtsAccess(
    { userId: CALLER, reasonCode: "confirmed_abuse" },
    { db: fakeDb, now: NOW }
  );
  assert.deepEqual(updates[0], {
    userId: CALLER,
    state: { ttsSuspendedAt: NOW, ttsSuspensionReasonCode: "confirmed_abuse" },
  });

  await liftTtsSuspension({ userId: CALLER }, { db: fakeDb });
  assert.deepEqual(updates[1], {
    userId: CALLER,
    state: { ttsSuspendedAt: null, ttsSuspensionReasonCode: null },
  });

  await assert.rejects(() =>
    suspendTtsAccess(
      { userId: CALLER, reasonCode: "free text with spaces!" },
      { db: fakeDb }
    )
  );
  await assert.rejects(() =>
    suspendTtsAccess({ userId: "user-ghost", reasonCode: "abuse" }, { db: fakeDb })
  );
});
