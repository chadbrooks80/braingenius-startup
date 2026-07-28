import assert from "node:assert/strict";
import test from "node:test";
import {
  checkUsernameAvailabilityAndSuggest,
  completeChildrenStep,
  handleOnboardingRecovery,
  type OnboardingNavigationRouter,
} from "../../src/lib/onboarding-client";
import type { OnboardingActionResult } from "../../src/lib/onboarding-funnel";

function fakeRouter() {
  const calls: { replace: string[]; refresh: number; push: string[] } = {
    replace: [],
    refresh: 0,
    push: [],
  };
  const router: OnboardingNavigationRouter = {
    replace: (href: string) => calls.replace.push(href),
    refresh: () => {
      calls.refresh += 1;
    },
    push: (href: string) => calls.push.push(href),
  };
  return { router, calls };
}

// --- handleOnboardingRecovery -------------------------------------------
//
// Every onboarding client component funnels its `recovery` and
// `unauthenticated` branches through this helper. These tests prove the
// exact navigation contract independent of any component, and that a
// duplicate/stale result never causes a second automatic attempt: the
// helper only ever navigates, it never re-invokes the mutation.

test("a recovery result navigates with router.replace(redirectTo) and refreshes server state", () => {
  const { router, calls } = fakeRouter();
  const result: OnboardingActionResult = { status: "recovery", redirectTo: "/verify-email" };

  const handled = handleOnboardingRecovery(result, router);

  assert.equal(handled, true);
  assert.deepEqual(calls.replace, ["/verify-email"]);
  assert.equal(calls.refresh, 1);
});

test("an unauthenticated result navigates to /sign-in without refreshing", () => {
  const { router, calls } = fakeRouter();
  const result: OnboardingActionResult = { status: "unauthenticated" };

  const handled = handleOnboardingRecovery(result, router);

  assert.equal(handled, true);
  assert.deepEqual(calls.replace, ["/sign-in"]);
  assert.equal(calls.refresh, 0);
});

test("a success result is not handled and triggers no navigation", () => {
  const { router, calls } = fakeRouter();
  const result: OnboardingActionResult = { status: "success", data: undefined };

  const handled = handleOnboardingRecovery(result, router);

  assert.equal(handled, false);
  assert.deepEqual(calls.replace, []);
  assert.equal(calls.refresh, 0);
});

test("an error result is not handled and triggers no navigation", () => {
  const { router, calls } = fakeRouter();
  const result: OnboardingActionResult = { status: "error", error: "Something went wrong." };

  const handled = handleOnboardingRecovery(result, router);

  assert.equal(handled, false);
  assert.deepEqual(calls.replace, []);
  assert.equal(calls.refresh, 0);
});

test("repeated recovery results each navigate but never retry the rejected mutation", () => {
  const { router, calls } = fakeRouter();
  let mutationAttempts = 0;

  async function staleMutation(): Promise<OnboardingActionResult> {
    mutationAttempts += 1;
    return { status: "recovery", redirectTo: "/getting-started" };
  }

  async function submit() {
    const result = await staleMutation();
    handleOnboardingRecovery(result, router);
  }

  return Promise.all([submit(), submit()]).then(() => {
    // Each caller is responsible for calling the mutation itself; the helper
    // never re-invokes it on the caller's behalf, so exactly two attempts
    // exist here -- one per explicit `submit()` call, not an automatic retry
    // triggered by the first recovery result.
    assert.equal(mutationAttempts, 2);
    assert.deepEqual(calls.replace, ["/getting-started", "/getting-started"]);
    assert.equal(calls.refresh, 2);
  });
});

// --- completeChildrenStep -------------------------------------------------
//
// Proves the CHILDREN -> COMPLETE client boundary calls `update()` with no
// arguments (a refresh request only -- never browser-selected onboarding
// claims) and only after a real success, then navigates to /dashboard.

test("a successful completion calls update() with no arguments and navigates to /dashboard", async () => {
  const { router, calls } = fakeRouter();
  const updateCalls: unknown[][] = [];
  const update = async (...args: unknown[]) => {
    updateCalls.push(args);
  };

  const result = await completeChildrenStep(
    async () => ({ status: "success", data: undefined }),
    { router, update }
  );

  assert.equal(result.status, "success");
  assert.equal(updateCalls.length, 1, "update() must be called exactly once on success");
  assert.deepEqual(updateCalls[0], [], "update() must be called with no arguments -- never client-selected claims");
  assert.deepEqual(calls.push, ["/dashboard"]);
  assert.deepEqual(calls.replace, []);
});

test("a recovery result during completion navigates through handleOnboardingRecovery and never calls update()", async () => {
  const { router, calls } = fakeRouter();
  let updateCalls = 0;
  const update = async () => {
    updateCalls += 1;
  };

  const result = await completeChildrenStep(
    async () => ({ status: "recovery", redirectTo: "/getting-started" }),
    { router, update }
  );

  assert.equal(result.status, "recovery");
  assert.equal(updateCalls, 0, "a rejected completion must never refresh the session");
  assert.deepEqual(calls.replace, ["/getting-started"]);
  assert.equal(calls.refresh, 1);
  assert.deepEqual(calls.push, []);
});

test("an unauthenticated result during completion redirects to /sign-in and never calls update()", async () => {
  const { router, calls } = fakeRouter();
  let updateCalls = 0;
  const update = async () => {
    updateCalls += 1;
  };

  const result = await completeChildrenStep(async () => ({ status: "unauthenticated" }), {
    router,
    update,
  });

  assert.equal(result.status, "unauthenticated");
  assert.equal(updateCalls, 0);
  assert.deepEqual(calls.replace, ["/sign-in"]);
  assert.deepEqual(calls.push, []);
});

test("an error result during completion is returned to the caller without navigation or update()", async () => {
  const { router, calls } = fakeRouter();
  let updateCalls = 0;
  const update = async () => {
    updateCalls += 1;
  };

  const result = await completeChildrenStep(
    async () => ({ status: "error", error: "Something went wrong." }),
    { router, update }
  );

  assert.deepEqual(result, { status: "error", error: "Something went wrong." });
  assert.equal(updateCalls, 0);
  assert.deepEqual(calls.replace, []);
  assert.deepEqual(calls.push, []);
});

// --- checkUsernameAvailabilityAndSuggest -----------------------------------
//
// Proves the complete availability-taken-follow-up-suggestion sequence used
// by AddChildForm's username blur handler. AOS-03: the second
// `suggestUsernames()` call (the taken-username follow-up) previously read
// only `status === "success"` and silently dropped `recovery` and
// `unauthenticated` results instead of navigating. These tests fail against
// that miswiring because they assert navigation happened and that the raw
// suggestion data was never surfaced as a "taken" result.

test("an available username is reported without calling suggestUsernames", async () => {
  const { router, calls } = fakeRouter();
  let suggestCalls = 0;

  const result = await checkUsernameAvailabilityAndSuggest(
    "alice",
    {
      checkUsernameAvailability: async () => ({ status: "success", data: { available: true } }),
      suggestUsernames: async () => {
        suggestCalls += 1;
        return { status: "success", data: { available: true, suggestions: [] } };
      },
    },
    { router }
  );

  assert.deepEqual(result, { status: "available" });
  assert.equal(suggestCalls, 0);
  assert.deepEqual(calls.replace, []);
});

test("a taken username returns suggestions from the follow-up call", async () => {
  const { router } = fakeRouter();
  let checkCalls = 0;
  let suggestCalls = 0;

  const result = await checkUsernameAvailabilityAndSuggest(
    "bob",
    {
      checkUsernameAvailability: async () => {
        checkCalls += 1;
        return { status: "success", data: { available: false } };
      },
      suggestUsernames: async () => {
        suggestCalls += 1;
        return { status: "success", data: { available: true, suggestions: ["bob1234", "bob5678"] } };
      },
    },
    { router }
  );

  assert.deepEqual(result, { status: "taken", suggestions: ["bob1234", "bob5678"] });
  assert.equal(checkCalls, 1);
  assert.equal(suggestCalls, 1);
});

test("a recovery result from the follow-up suggestUsernames call navigates and is not reported as taken", async () => {
  const { router, calls } = fakeRouter();
  let suggestCalls = 0;

  const result = await checkUsernameAvailabilityAndSuggest(
    "carol",
    {
      checkUsernameAvailability: async () => ({ status: "success", data: { available: false } }),
      suggestUsernames: async () => {
        suggestCalls += 1;
        return { status: "recovery", redirectTo: "/getting-started" };
      },
    },
    { router }
  );

  assert.deepEqual(result, { status: "recovery", redirectTo: "/getting-started" });
  assert.deepEqual(calls.replace, ["/getting-started"]);
  assert.equal(calls.refresh, 1);
  assert.equal(suggestCalls, 1, "the follow-up call must not be retried after recovery");
});

test("an unauthenticated result from the follow-up suggestUsernames call navigates to /sign-in", async () => {
  const { router, calls } = fakeRouter();
  let suggestCalls = 0;

  const result = await checkUsernameAvailabilityAndSuggest(
    "dave",
    {
      checkUsernameAvailability: async () => ({ status: "success", data: { available: false } }),
      suggestUsernames: async () => {
        suggestCalls += 1;
        return { status: "unauthenticated" };
      },
    },
    { router }
  );

  assert.deepEqual(result, { status: "unauthenticated" });
  assert.deepEqual(calls.replace, ["/sign-in"]);
  assert.equal(suggestCalls, 1, "the follow-up call must not be retried after an unauthenticated result");
});

test("a recovery result from the initial checkUsernameAvailability call never calls suggestUsernames", async () => {
  const { router, calls } = fakeRouter();
  let suggestCalls = 0;

  const result = await checkUsernameAvailabilityAndSuggest(
    "erin",
    {
      checkUsernameAvailability: async () => ({ status: "recovery", redirectTo: "/verify-email" }),
      suggestUsernames: async () => {
        suggestCalls += 1;
        return { status: "success", data: { available: true, suggestions: [] } };
      },
    },
    { router }
  );

  assert.deepEqual(result, { status: "recovery", redirectTo: "/verify-email" });
  assert.deepEqual(calls.replace, ["/verify-email"]);
  assert.equal(suggestCalls, 0);
});
