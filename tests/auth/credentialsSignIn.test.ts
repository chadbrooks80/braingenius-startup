import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { before, beforeEach, test } from "node:test";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic import below so `@/lib/db` and `next-auth`
// resolve to the fakes for every transitive import auth.ts performs.
registerAuthTestHooks();

import { __resetFakeDb, __seedUser } from "./testDoubles/fakeDb";

type Credentials = { username: string; password: string };
type Authorize = (credentials: Credentials | undefined) => Promise<unknown>;

let authorize: Authorize;

before(async () => {
  const { authOptions } = await import("../../src/auth");
  const credentialsProvider = authOptions.providers[1] as unknown as { authorize: Authorize };
  authorize = credentialsProvider.authorize;
});

beforeEach(() => {
  __resetFakeDb();
});

test("accepts a case-variant, whitespace-padded email and authenticates the canonical account", async () => {
  const hashed = await bcrypt.hash("password123", 10);
  __seedUser({
    email: "parent@example.com",
    password: hashed,
    role: "PARENT",
    emailVerified: new Date(),
  });

  const result = await authorize({ username: "  Parent@Example.com  ", password: "password123" });

  assert.ok(result);
  assert.equal((result as { email: string | null }).email, "parent@example.com");
});

test("rejects the correct password against a different account's email casing when no such account exists", async () => {
  const result = await authorize({ username: "Nobody@Example.com", password: "password123" });
  assert.equal(result, null);
});

test("rejects a wrong password for a canonically matched account", async () => {
  const hashed = await bcrypt.hash("password123", 10);
  __seedUser({
    email: "parent@example.com",
    password: hashed,
    role: "PARENT",
    emailVerified: new Date(),
  });

  const result = await authorize({ username: "parent@example.com", password: "wrong-password" });

  assert.equal(result, null);
});

test("rejects malformed email-shaped input without ever matching an account", async () => {
  const hashed = await bcrypt.hash("password123", 10);
  __seedUser({
    email: "parent@example.com",
    password: hashed,
    role: "PARENT",
    emailVerified: new Date(),
  });

  const result = await authorize({ username: "not@@valid", password: "password123" });

  assert.equal(result, null);
});

test("username sign-in is unaffected by email normalization", async () => {
  const hashed = await bcrypt.hash("password123", 10);
  __seedUser({ username: "childuser1", password: hashed, role: "CHILD" });

  const result = await authorize({ username: "childuser1", password: "password123" });

  assert.ok(result);
});

test("a non-child account without email verification is rejected even with a casing-variant lookup", async () => {
  const hashed = await bcrypt.hash("password123", 10);
  __seedUser({
    email: "unverified@example.com",
    password: hashed,
    role: "PARENT",
    emailVerified: null,
  });

  await assert.rejects(
    () => authorize({ username: "Unverified@Example.com", password: "password123" }),
    /EMAIL_NOT_VERIFIED/
  );
});

test("a CHILD account signs in by email casing variant without requiring email verification", async () => {
  const hashed = await bcrypt.hash("password123", 10);
  __seedUser({
    email: "child@example.com",
    password: hashed,
    role: "CHILD",
    emailVerified: null,
  });

  const result = await authorize({ username: "Child@Example.com", password: "password123" });

  assert.ok(result);
});
