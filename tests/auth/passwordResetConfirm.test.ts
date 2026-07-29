import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { before, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

registerAuthTestHooks();

import {
  __getPasswordResetTokens,
  __getUsers,
  __resetFakeDb,
  __seedPasswordResetToken,
  __seedUser,
} from "./testDoubles/fakeDb";
import { hashValue } from "../../src/lib/auth-tokens";

let passwordResetConfirm: typeof import("../../src/app/api/auth/password-reset/confirm/route").POST;

before(async () => {
  ({ POST: passwordResetConfirm } = await import(
    "../../src/app/api/auth/password-reset/confirm/route"
  ));
});

beforeEach(() => {
  __resetFakeDb();
});

const CONFIRM_URL = "http://localhost/api/auth/password-reset/confirm";
const RAW_TOKEN = "a-valid-raw-reset-token";

function postJson(body: unknown): NextRequest {
  return new NextRequest(CONFIRM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedUserWithToken(overrides: Record<string, unknown> = {}) {
  const oldHash = await bcrypt.hash("old-password-1", 10);
  const user = __seedUser({
    email: "reset@example.com",
    password: oldHash,
    role: "PARENT",
    mustResetPassword: false,
    ...overrides,
  });
  __seedPasswordResetToken({ userId: user.id, tokenHash: hashValue(RAW_TOKEN) });
  return user;
}

test("a valid token and a casing-variant email confirm the token owner and set the new password", async () => {
  const user = await seedUserWithToken();

  const response = await passwordResetConfirm(
    postJson({ email: "Reset@Example.com", token: RAW_TOKEN, password: "brand-new-password-1" })
  );

  assert.deepEqual(await response.json(), { success: true });
  const stored = __getUsers().find((u) => u.id === user.id)!;
  assert.ok(await bcrypt.compare("brand-new-password-1", stored.password ?? ""));
});

test("a valid token also clears a pending required-reset flag in the same transaction", async () => {
  const user = await seedUserWithToken({ mustResetPassword: true });

  const response = await passwordResetConfirm(
    postJson({ email: "reset@example.com", token: RAW_TOKEN, password: "brand-new-password-1" })
  );

  assert.deepEqual(await response.json(), { success: true });
  const stored = __getUsers().find((u) => u.id === user.id)!;
  assert.equal(stored.mustResetPassword, false);
});

test("rejects a genuinely different email even with a valid token", async () => {
  const user = await seedUserWithToken();

  const response = await passwordResetConfirm(
    postJson({ email: "someone-else@example.com", token: RAW_TOKEN, password: "brand-new-password-1" })
  );

  assert.equal(response.status, 400);
  const stored = __getUsers().find((u) => u.id === user.id)!;
  assert.ok(await bcrypt.compare("old-password-1", stored.password ?? ""), "password must be unchanged");
});

test("rejects an expired token and leaves the account untouched", async () => {
  const oldHash = await bcrypt.hash("old-password-1", 10);
  const user = __seedUser({ email: "expired@example.com", password: oldHash });
  __seedPasswordResetToken({
    userId: user.id,
    tokenHash: hashValue(RAW_TOKEN),
    expiresAt: new Date(Date.now() - 1000),
  });

  const response = await passwordResetConfirm(
    postJson({ email: "expired@example.com", token: RAW_TOKEN, password: "brand-new-password-1" })
  );

  assert.equal(response.status, 400);
  const stored = __getUsers().find((u) => u.id === user.id)!;
  assert.ok(await bcrypt.compare("old-password-1", stored.password ?? ""));
});

test("rejects an already-used token", async () => {
  const oldHash = await bcrypt.hash("old-password-1", 10);
  const user = __seedUser({ email: "used@example.com", password: oldHash });
  __seedPasswordResetToken({
    userId: user.id,
    tokenHash: hashValue(RAW_TOKEN),
    usedAt: new Date(),
  });

  const response = await passwordResetConfirm(
    postJson({ email: "used@example.com", token: RAW_TOKEN, password: "brand-new-password-1" })
  );

  assert.equal(response.status, 400);
});

test("rejects an unknown token without a database match", async () => {
  const response = await passwordResetConfirm(
    postJson({ email: "nobody@example.com", token: "unknown-token", password: "brand-new-password-1" })
  );

  assert.equal(response.status, 400);
  assert.equal(__getPasswordResetTokens().length, 0);
});

test("rejects a short new password before touching the database", async () => {
  const user = await seedUserWithToken();

  const response = await passwordResetConfirm(
    postJson({ email: "reset@example.com", token: RAW_TOKEN, password: "short" })
  );

  assert.equal(response.status, 400);
  const stored = __getUsers().find((u) => u.id === user.id)!;
  assert.ok(await bcrypt.compare("old-password-1", stored.password ?? ""));
});
