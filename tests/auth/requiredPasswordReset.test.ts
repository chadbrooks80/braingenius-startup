import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { before, beforeEach, test } from "node:test";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic import below so `@/lib/db` and `next-auth`
// resolve to the fakes for every transitive import the action performs.
registerAuthTestHooks();

import { __getUsers, __resetFakeDb, __seedUser } from "./testDoubles/fakeDb";
import { __setSessionUserId } from "./testDoubles/fakeNextAuth";

let submitRequiredPasswordReset: typeof import("../../src/actions/required-password-reset").submitRequiredPasswordReset;

const CURRENT_PASSWORD = "current-password-1";
const NEW_PASSWORD = "new-password-1";

before(async () => {
  ({ submitRequiredPasswordReset } = await import("../../src/actions/required-password-reset"));
});

beforeEach(() => {
  __resetFakeDb();
  __setSessionUserId(undefined);
});

async function seedResetRequiredChild(overrides: Record<string, unknown> = {}) {
  const hashed = await bcrypt.hash(CURRENT_PASSWORD, 10);
  return __seedUser({
    role: "CHILD",
    username: "kid1",
    password: hashed,
    mustResetPassword: true,
    ...overrides,
  });
}

test("rejects an unauthenticated caller", async () => {
  const result = await submitRequiredPasswordReset({
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmNewPassword: NEW_PASSWORD,
  });

  assert.deepEqual(result, { status: "unauthenticated" });
});

test("rejects a deleted session user", async () => {
  __setSessionUserId("missing-user-id");

  const result = await submitRequiredPasswordReset({
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmNewPassword: NEW_PASSWORD,
  });

  assert.deepEqual(result, { status: "unauthenticated" });
});

test("rejects a short new password before touching the database", async () => {
  const user = await seedResetRequiredChild();
  __setSessionUserId(user.id);

  const result = await submitRequiredPasswordReset({
    currentPassword: CURRENT_PASSWORD,
    newPassword: "short",
    confirmNewPassword: "short",
  });

  assert.equal(result.status, "error");
  assert.equal(__getUsers()[0].mustResetPassword, true, "password must not change");
});

test("rejects a missing confirmation with zero database mutation", async () => {
  const user = await seedResetRequiredChild();
  __setSessionUserId(user.id);

  const result = await submitRequiredPasswordReset({
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmNewPassword: "",
  });

  assert.equal(result.status, "error");
  const stored = __getUsers()[0];
  assert.equal(stored.mustResetPassword, true);
  assert.ok(await bcrypt.compare(CURRENT_PASSWORD, stored.password ?? ""));
});

test("rejects a mismatched confirmation with zero database mutation, even when the current password is correct", async () => {
  const user = await seedResetRequiredChild();
  __setSessionUserId(user.id);

  const result = await submitRequiredPasswordReset({
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmNewPassword: "a-completely-different-password",
  });

  assert.equal(result.status, "error");
  const stored = __getUsers()[0];
  assert.equal(stored.mustResetPassword, true);
  assert.ok(await bcrypt.compare(CURRENT_PASSWORD, stored.password ?? ""));
});

test("an account whose flag is already clear is routed to recovery instead of running security checks", async () => {
  const hashed = await bcrypt.hash(CURRENT_PASSWORD, 10);
  const user = __seedUser({
    role: "PARENT",
    email: "parent@example.com",
    password: hashed,
    mustResetPassword: false,
    onboardingStep: "COMPLETE",
    onboardingCompleted: true,
  });
  __setSessionUserId(user.id);

  const result = await submitRequiredPasswordReset({
    currentPassword: "wrong-on-purpose",
    newPassword: NEW_PASSWORD,
    confirmNewPassword: NEW_PASSWORD,
  });

  assert.deepEqual(result, { status: "recovery", redirectTo: "/dashboard" });
  assert.equal(__getUsers()[0].password, hashed, "password must not change for an ineligible account");
});

test("an OAuth-only account with no password recovers instead of attempting the reset", async () => {
  const user = __seedUser({
    role: "CHILD",
    username: "oauthkid",
    password: null,
    mustResetPassword: true,
  });
  __setSessionUserId(user.id);

  const result = await submitRequiredPasswordReset({
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmNewPassword: NEW_PASSWORD,
  });

  assert.equal(result.status, "recovery");
});

test("rejects the wrong current password with a generic result and no mutation", async () => {
  const user = await seedResetRequiredChild();
  __setSessionUserId(user.id);

  const result = await submitRequiredPasswordReset({
    currentPassword: "totally-wrong",
    newPassword: NEW_PASSWORD,
    confirmNewPassword: NEW_PASSWORD,
  });

  assert.equal(result.status, "error");
  const stored = __getUsers()[0];
  assert.equal(stored.mustResetPassword, true);
  assert.notEqual(stored.password, null);
});

test("rejects a new password identical to the current password with the same generic result", async () => {
  const user = await seedResetRequiredChild();
  __setSessionUserId(user.id);

  const result = await submitRequiredPasswordReset({
    currentPassword: CURRENT_PASSWORD,
    newPassword: CURRENT_PASSWORD,
    confirmNewPassword: CURRENT_PASSWORD,
  });

  assert.equal(result.status, "error");
  assert.equal(__getUsers()[0].mustResetPassword, true, "no mutation may occur");
});

test("a valid reset changes the hash and clears the flag together, and routes a CHILD to /dashboard", async () => {
  const user = await seedResetRequiredChild();
  __setSessionUserId(user.id);

  const result = await submitRequiredPasswordReset({
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmNewPassword: NEW_PASSWORD,
  });

  assert.deepEqual(result, { status: "success", data: { redirectTo: "/dashboard" } });

  const stored = __getUsers()[0];
  assert.equal(stored.mustResetPassword, false);
  assert.ok(await bcrypt.compare(NEW_PASSWORD, stored.password ?? ""));
  assert.ok(!(await bcrypt.compare(CURRENT_PASSWORD, stored.password ?? "")));
});

test("a valid reset for a PARENT routes to the parent's current onboarding destination", async () => {
  const hashed = await bcrypt.hash(CURRENT_PASSWORD, 10);
  const user = __seedUser({
    role: "PARENT",
    email: "parent@example.com",
    password: hashed,
    mustResetPassword: true,
    onboardingStep: "PROFILE",
    onboardingCompleted: false,
  });
  __setSessionUserId(user.id);

  const result = await submitRequiredPasswordReset({
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmNewPassword: NEW_PASSWORD,
  });

  assert.deepEqual(result, { status: "success", data: { redirectTo: "/getting-started" } });
});

test("a repeated request after a successful reset recovers instead of changing the password again", async () => {
  const user = await seedResetRequiredChild();
  __setSessionUserId(user.id);

  const first = await submitRequiredPasswordReset({
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmNewPassword: NEW_PASSWORD,
  });
  assert.equal(first.status, "success");

  const hashAfterFirst = __getUsers()[0].password;

  const second = await submitRequiredPasswordReset({
    currentPassword: NEW_PASSWORD,
    newPassword: "yet-another-password",
    confirmNewPassword: "yet-another-password",
  });

  assert.deepEqual(second, { status: "recovery", redirectTo: "/dashboard" });
  assert.equal(__getUsers()[0].password, hashAfterFirst, "the second request must not change the password");
});

test("two concurrent reset submissions produce exactly one successful transition", async () => {
  const user = await seedResetRequiredChild();
  __setSessionUserId(user.id);

  const [first, second] = await Promise.all([
    submitRequiredPasswordReset({
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmNewPassword: NEW_PASSWORD,
    }),
    submitRequiredPasswordReset({
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmNewPassword: NEW_PASSWORD,
    }),
  ]);

  const outcomes = [first.status, second.status].sort();
  assert.deepEqual(outcomes, ["recovery", "success"]);
  assert.equal(__getUsers()[0].mustResetPassword, false);
});
