import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic imports below so `@/lib/db` and `next-auth`
// resolve to the fakes for every transitive import the pages perform.
registerAuthTestHooks();

import { __resetFakeDb, __seedUser } from "./testDoubles/fakeDb";
import { __setSessionUserId } from "./testDoubles/fakeNextAuth";

let RestrictedPage: () => Promise<unknown>;
let UsersPage: () => Promise<unknown>;

before(async () => {
  ({ default: RestrictedPage } = await import("../../src/app/playground/restrict/page"));
  ({ default: UsersPage } = await import("../../src/app/playground/users/page"));
});

beforeEach(() => {
  __resetFakeDb();
  __setSessionUserId(undefined);
});

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

async function run(page: () => Promise<unknown>) {
  try {
    await page();
    return { redirected: false as const };
  } catch (error) {
    if (isRedirectError(error)) {
      return { redirected: true as const, destination: redirectDestination(error) };
    }
    throw error;
  }
}

test("playground/restrict: anonymous request redirects to /sign-in", async () => {
  const result = await run(RestrictedPage);
  assert.deepEqual(result, { redirected: true, destination: "/sign-in" });
});

test("playground/restrict: a session whose user row is missing fails closed to /sign-in", async () => {
  __setSessionUserId("missing-user-id");
  const result = await run(RestrictedPage);
  assert.deepEqual(result, { redirected: true, destination: "/sign-in" });
});

test("playground/restrict: a reset-required account is redirected to /required-password-reset", async () => {
  const user = __seedUser({ role: "CHILD", mustResetPassword: true });
  __setSessionUserId(user.id);
  const result = await run(RestrictedPage);
  assert.deepEqual(result, { redirected: true, destination: "/required-password-reset" });
});

test("playground/restrict: a cleared account renders normally", async () => {
  const user = __seedUser({ role: "PARENT", mustResetPassword: false, onboardingCompleted: true, onboardingStep: "COMPLETE" });
  __setSessionUserId(user.id);
  const result = await run(RestrictedPage);
  assert.deepEqual(result, { redirected: false });
});

test("playground/users: anonymous request redirects to /sign-in with the original callbackUrl", async () => {
  const result = await run(UsersPage);
  assert.deepEqual(result, { redirected: true, destination: "/sign-in?callbackUrl=%2Fplayground%2Fusers" });
});

test("playground/users: a session whose user row is missing fails closed to /sign-in", async () => {
  __setSessionUserId("missing-user-id");
  const result = await run(UsersPage);
  assert.deepEqual(result, { redirected: true, destination: "/sign-in" });
});

test("playground/users: a reset-required account is redirected to /required-password-reset", async () => {
  const user = __seedUser({ role: "CHILD", mustResetPassword: true });
  __setSessionUserId(user.id);
  const result = await run(UsersPage);
  assert.deepEqual(result, { redirected: true, destination: "/required-password-reset" });
});

test("playground/users: a cleared account renders normally", async () => {
  const user = __seedUser({ role: "PARENT", mustResetPassword: false, onboardingCompleted: true, onboardingStep: "COMPLETE" });
  __setSessionUserId(user.id);
  const result = await run(UsersPage);
  assert.deepEqual(result, { redirected: false });
});
