import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic import below so `@/lib/db` and `@/lib/email`
// resolve to the fakes for every transitive import register.ts performs.
registerAuthTestHooks();

import {
  __getUsers,
  __getVerificationCodes,
  __resetFakeDb,
  __seedUser,
  __simulateConcurrentCreateConflict,
  __simulateUnexpectedFailure,
} from "./testDoubles/fakeDb";
import { __getSentEmails, __resetFakeEmail } from "./testDoubles/fakeEmail";

let registerUser: typeof import("../../src/actions/register").registerUser;

before(async () => {
  ({ registerUser } = await import("../../src/actions/register"));
});

beforeEach(() => {
  __resetFakeDb();
  __resetFakeEmail();
});

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

test("rejects a malformed email", async () => {
  const result = await registerUser(formData({ email: "not-an-email", password: "password123" }));

  assert.equal(result.success, false);
  assert.match(result.error ?? "", /email/i);
  assert.equal(__getUsers().length, 0);
});

test("rejects a short password", async () => {
  const result = await registerUser(formData({ email: "new@example.com", password: "short" }));

  assert.equal(result.success, false);
  assert.match(result.error ?? "", /password/i);
  assert.equal(__getUsers().length, 0);
});

test("a new valid email is accepted and creates the account, verification code, and one delivery attempt", async () => {
  const result = await registerUser(
    formData({ email: "new@example.com", password: "password123" })
  );

  assert.deepEqual(result, { success: true });
  assert.equal(__getUsers().length, 1);
  assert.equal(__getUsers()[0].email, "new@example.com");
  assert.equal(__getVerificationCodes().length, 1);
  assert.equal(__getVerificationCodes()[0].email, "new@example.com");
  assert.equal(__getSentEmails().length, 1);
  assert.equal(__getSentEmails()[0].email, "new@example.com");
});

test("an existing verified email returns the identical accepted shape and performs no destructive or duplicate writes", async () => {
  __seedUser({
    email: "verified@example.com",
    password: "existing-hash",
    emailVerified: new Date(),
  });

  const result = await registerUser(
    formData({ email: "verified@example.com", password: "password123" })
  );

  assert.deepEqual(result, { success: true });
  assert.equal(__getUsers().length, 1);
  assert.equal(__getUsers()[0].password, "existing-hash", "existing password must not be rehashed");
  assert.ok(__getUsers()[0].emailVerified, "verification state must not be reset");
  assert.equal(__getVerificationCodes().length, 0, "a verified account must not get a new code");
  assert.equal(__getSentEmails().length, 0, "a verified account must not receive a new-account email");
});

test("an existing unverified email returns the identical accepted shape and does not overwrite the account", async () => {
  __seedUser({
    email: "unverified@example.com",
    password: "existing-hash",
    emailVerified: null,
  });

  const result = await registerUser(
    formData({ email: "unverified@example.com", password: "password123" })
  );

  assert.deepEqual(result, { success: true });
  assert.equal(__getUsers().length, 1, "no duplicate account may be created");
  assert.equal(__getUsers()[0].password, "existing-hash", "existing password must not be rehashed");
  assert.equal(__getVerificationCodes().length, 1);
  assert.equal(__getSentEmails().length, 1);
});

test("a concurrent email-uniqueness race resolves to the same accepted response", async () => {
  __simulateConcurrentCreateConflict();

  const result = await registerUser(
    formData({ email: "race@example.com", password: "password123" })
  );

  assert.deepEqual(result, { success: true });
});

test("an unexpected database failure returns the generic failure contract and stays observable", async () => {
  __simulateUnexpectedFailure();

  const originalConsoleError = console.error;
  const loggedCalls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    loggedCalls.push(args);
  };

  let result: { success: boolean; error?: string };
  try {
    result = await registerUser(formData({ email: "boom@example.com", password: "password123" }));
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(result.success, false);
  assert.equal(result.error, "Something went wrong. Please try again.");
  assert.ok(loggedCalls.length > 0, "the unexpected failure must remain observable server-side");
});
