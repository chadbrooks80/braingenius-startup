import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { registerBillingRouteTestHooks } from "./testDoubles/registerBillingRouteTestHooks";
import { registerAuthTestHooks } from "../auth/testDoubles/registerAuthTestHooks";

// Must run before the dynamic import below so `@/lib/db`, `@/lib/stripe`,
// and `next-auth` all resolve to fakes for every transitive import the
// action performs.
registerBillingRouteTestHooks();
registerAuthTestHooks();

import {
  __getCheckoutSessionCalls,
  __resetFakeStripeCheckoutSessions,
  __setCheckoutSessionResult,
} from "./testDoubles/fakeStripe";
import { __resetFakeDb, __seedUser } from "../auth/testDoubles/fakeDb";
import { __setSessionUserId } from "../auth/testDoubles/fakeNextAuth";

let createCheckoutSession: typeof import("../../src/actions/checkout").createCheckoutSession;

before(async () => {
  ({ createCheckoutSession } = await import("../../src/actions/checkout"));
});

beforeEach(() => {
  __resetFakeDb();
  __resetFakeStripeCheckoutSessions();
  __setSessionUserId(undefined);
});

test("an unauthenticated caller is rejected before any Stripe call", async () => {
  const result = await createCheckoutSession("MONTHLY");

  assert.deepEqual(result, { success: false, error: "You must be signed in to upgrade." });
  assert.deepEqual(__getCheckoutSessionCalls(), []);
});

test("an invalid plan is rejected before any Stripe call", async () => {
  const user = __seedUser({ role: "PARENT", mustResetPassword: false });
  __setSessionUserId(user.id);

  const result = await createCheckoutSession("YEARLY" as never);

  assert.equal(result.success, false);
  assert.deepEqual(__getCheckoutSessionCalls(), []);
});

test("a session whose user row no longer exists is rejected before any Stripe call", async () => {
  __setSessionUserId("missing-user-id");

  const result = await createCheckoutSession("MONTHLY");

  assert.deepEqual(result, { success: false, error: "Account not found." });
  assert.deepEqual(__getCheckoutSessionCalls(), []);
});

test("a reset-required account is rejected before any Stripe call", async () => {
  const user = __seedUser({ role: "CHILD", mustResetPassword: true });
  __setSessionUserId(user.id);

  const result = await createCheckoutSession("MONTHLY");

  assert.deepEqual(result, {
    success: false,
    error: "You must reset your password before continuing.",
  });
  assert.deepEqual(__getCheckoutSessionCalls(), []);
});

test("an eligible account creates exactly one Stripe checkout session and returns its url", async () => {
  const user = __seedUser({ role: "PARENT", mustResetPassword: false, email: "parent@example.com" });
  __setSessionUserId(user.id);
  __setCheckoutSessionResult({ url: "https://checkout.stripe.test/cs_test_1" });

  const result = await createCheckoutSession("MONTHLY");

  assert.deepEqual(result, { success: true, url: "https://checkout.stripe.test/cs_test_1" });
  assert.equal(__getCheckoutSessionCalls().length, 1);
  assert.equal(__getCheckoutSessionCalls()[0].client_reference_id, user.id);
});

test("a missing Stripe session url is reported as a generic failure", async () => {
  const user = __seedUser({ role: "PARENT", mustResetPassword: false, email: "parent@example.com" });
  __setSessionUserId(user.id);
  __setCheckoutSessionResult({ url: null });

  const result = await createCheckoutSession("MONTHLY");

  assert.equal(result.success, false);
});

test("a Stripe failure is reported as a generic error, not surfaced to the caller", async () => {
  const user = __seedUser({ role: "PARENT", mustResetPassword: false, email: "parent@example.com" });
  __setSessionUserId(user.id);
  __setCheckoutSessionResult("throw");

  const result = await createCheckoutSession("MONTHLY");

  assert.deepEqual(result, { success: false, error: "Could not start checkout. Please try again." });
});
