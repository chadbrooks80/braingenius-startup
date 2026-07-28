import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic import below so `@/lib/db` and `next-auth`
// resolve to the fakes for every transitive import the page performs.
registerAuthTestHooks();

import { __getUsers, __resetFakeDb, __seedUser } from "./testDoubles/fakeDb";
import { __setSessionUserId } from "./testDoubles/fakeNextAuth";

type GettingStartedPageProps = { searchParams: Promise<{ checkout?: string }> };

let GettingStartedPage: (props: GettingStartedPageProps) => Promise<unknown>;

before(async () => {
  ({ default: GettingStartedPage } = await import(
    "../../src/app/(auth)/(onboarding)/getting-started/page"
  ));
});

beforeEach(() => {
  __resetFakeDb();
  __setSessionUserId(undefined);
});

function seedParent(onboardingStep: string, overrides: Record<string, unknown> = {}) {
  return __seedUser({ role: "PARENT", onboardingStep, ...overrides });
}

// A `redirect()` call from "next/navigation" throws rather than returning, so
// the real page boundary (not a re-implementation of it) is exercised here
// by calling the real exported page function and catching that throw --
// exactly the digest shape Next.js's own rendering pipeline recognizes.
function isRedirectError(error: unknown): error is { digest: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT;")
  );
}

function redirectDestination(error: { digest: string }): string {
  return error.digest.split(";").slice(2, -2).join(";");
}

async function runPage(
  checkout?: string
): Promise<{ redirected: true; destination: string } | { redirected: false }> {
  try {
    await GettingStartedPage({ searchParams: Promise.resolve({ checkout }) });
    return { redirected: false };
  } catch (error) {
    if (isRedirectError(error)) {
      return { redirected: true, destination: redirectDestination(error) };
    }
    throw error;
  }
}

test("checkout=success advances PLAN -> CHILDREN only when the database parent is still on PLAN and incomplete", async () => {
  const parent = seedParent("PLAN");
  __setSessionUserId(parent.id);

  const result = await runPage("success");

  assert.deepEqual(result, { redirected: true, destination: "/getting-started" });
  assert.equal(__getUsers()[0].onboardingStep, "CHILDREN", "the checkout return must advance the funnel");
});

test("a repeated checkout=success request after the first success does not advance the funnel again", async () => {
  const parent = seedParent("PLAN");
  __setSessionUserId(parent.id);

  await runPage("success");
  assert.equal(__getUsers()[0].onboardingStep, "CHILDREN");

  const repeated = await runPage("success");

  assert.deepEqual(repeated, { redirected: false }, "a stale replay renders the current CHILDREN step instead of redirecting");
  assert.equal(__getUsers()[0].onboardingStep, "CHILDREN", "only the first request may advance");
});

test("checkout=success from an earlier stored step does not advance and renders the current step", async () => {
  const parent = seedParent("WELCOME_VIDEO");
  __setSessionUserId(parent.id);

  const result = await runPage("success");

  assert.deepEqual(result, { redirected: false });
  assert.equal(__getUsers()[0].onboardingStep, "WELCOME_VIDEO");
});

test("checkout=success from a later stored step does not advance and renders the current step", async () => {
  const parent = seedParent("CHILDREN");
  __setSessionUserId(parent.id);

  const result = await runPage("success");

  assert.deepEqual(result, { redirected: false });
  assert.equal(__getUsers()[0].onboardingStep, "CHILDREN");
});

test("checkout=success for a completed account redirects to /dashboard without touching onboarding state", async () => {
  const done = seedParent("COMPLETE", { onboardingCompleted: true });
  __setSessionUserId(done.id);

  const result = await runPage("success");

  assert.deepEqual(result, { redirected: true, destination: "/dashboard" });
  assert.equal(__getUsers()[0].onboardingStep, "COMPLETE");
});

test("checkout=success for a missing account redirects to /sign-in", async () => {
  // A signed session whose user row no longer exists in the database.
  __setSessionUserId("missing-user-id");

  const result = await runPage("success");

  assert.deepEqual(result, { redirected: true, destination: "/sign-in" });
});

test("checkout=success for an unauthenticated request redirects to /sign-in without reading onboarding state", async () => {
  const result = await runPage("success");

  assert.deepEqual(result, { redirected: true, destination: "/sign-in" });
});

test("visiting getting-started without checkout=success never advances PLAN", async () => {
  const parent = seedParent("PLAN");
  __setSessionUserId(parent.id);

  const result = await runPage(undefined);

  assert.deepEqual(result, { redirected: false });
  assert.equal(__getUsers()[0].onboardingStep, "PLAN", "only an explicit checkout=success may advance PLAN");
});
