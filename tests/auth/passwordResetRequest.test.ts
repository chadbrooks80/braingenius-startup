import assert from "node:assert/strict";
import { afterEach, before, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

registerAuthTestHooks();

import {
  __failNextDbOperation,
  __getPasswordResetTokens,
  __getUsers,
  __resetFakeDb,
  __seedPasswordResetToken,
  __seedUser,
} from "./testDoubles/fakeDb";
import {
  __failNextSend,
  __getSentEmails,
  __resetFakeEmail,
} from "./testDoubles/fakeEmail";

let passwordResetRequest: typeof import("../../src/app/api/auth/password-reset/request/route").POST;

const ENV_KEYS = ["NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL", "NODE_ENV"] as const;
let savedEnv: Record<string, string | undefined>;

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    Reflect.set(process.env, key, value);
  }
}

before(async () => {
  ({ POST: passwordResetRequest } = await import(
    "../../src/app/api/auth/password-reset/request/route"
  ));
});

beforeEach(() => {
  __resetFakeDb();
  __resetFakeEmail();
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  setEnv("NEXTAUTH_URL", "https://app.example.com");
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    setEnv(key, savedEnv[key]);
  }
});

const REQUEST_URL = "http://localhost/api/auth/password-reset/request";

function postJson(body: unknown): NextRequest {
  return new NextRequest(REQUEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("an eligible credentials account creates a reset token and sends the trusted reset URL", async () => {
  __seedUser({ email: "eligible@example.com", password: "hashed" });

  const response = await passwordResetRequest(postJson({ email: "eligible@example.com" }));

  assert.deepEqual(await response.json(), { success: true });
  assert.equal(__getPasswordResetTokens().length, 1);
  assert.equal(__getSentEmails().length, 1);
  const [sent] = __getSentEmails();
  assert.equal(sent.type, "password-reset");
  assert.ok(sent.payload.startsWith("https://app.example.com/reset-password?token="));
});

test("an unknown email returns the same generic response and creates no token", async () => {
  const response = await passwordResetRequest(postJson({ email: "unknown@example.com" }));

  assert.deepEqual(await response.json(), { success: true });
  assert.equal(__getPasswordResetTokens().length, 0);
  assert.equal(__getSentEmails().length, 0);
});

test("an OAuth-only account (no password) returns the generic response and creates no token", async () => {
  __seedUser({ email: "oauth-only@example.com", password: null });

  const response = await passwordResetRequest(postJson({ email: "oauth-only@example.com" }));

  assert.deepEqual(await response.json(), { success: true });
  assert.equal(__getPasswordResetTokens().length, 0);
});

test("a request inside the cooldown window creates no additional token or email", async () => {
  const user = __seedUser({ email: "cooldown@example.com", password: "hashed" });
  __seedPasswordResetToken({ userId: user.id, tokenHash: "existing-hash" });

  const response = await passwordResetRequest(postJson({ email: "cooldown@example.com" }));

  assert.deepEqual(await response.json(), { success: true });
  assert.equal(__getPasswordResetTokens().length, 1, "no new token may be created during cooldown");
  assert.equal(__getSentEmails().length, 0);
});

test("malformed input returns the same generic response", async () => {
  const response = await passwordResetRequest(
    new NextRequest(REQUEST_URL, { method: "POST", body: "not json" })
  );

  assert.deepEqual(await response.json(), { success: true });
});

test("in production with no trusted origin configured, no token is created and the response stays generic", async () => {
  setEnv("NODE_ENV", "production");
  setEnv("NEXTAUTH_URL", undefined);
  setEnv("NEXT_PUBLIC_APP_URL", undefined);
  __seedUser({ email: "eligible@example.com", password: "hashed" });

  const response = await passwordResetRequest(postJson({ email: "eligible@example.com" }));

  assert.deepEqual(await response.json(), { success: true });
  assert.equal(
    __getPasswordResetTokens().length,
    0,
    "an unusable reset link must never be created"
  );
  assert.equal(__getSentEmails().length, 0);
  assert.equal(__getUsers()[0].password, "hashed", "the account is otherwise untouched");
});

test("two concurrent eligible requests create one reset token and one delivery", async () => {
  __seedUser({ email: "concurrent@example.com", password: "hashed" });

  const responses = await Promise.all([
    passwordResetRequest(postJson({ email: "concurrent@example.com" })),
    passwordResetRequest(postJson({ email: "concurrent@example.com" })),
  ]);

  assert.deepEqual(
    await Promise.all(responses.map((response) => response.json())),
    [{ success: true }, { success: true }]
  );
  assert.equal(__getPasswordResetTokens().length, 1);
  assert.equal(__getSentEmails().length, 1);
});

test("a token-create failure commits nothing, sends nothing, and keeps the generic response", async () => {
  __seedUser({ email: "transaction-failure@example.com", password: "hashed" });
  __failNextDbOperation("password-reset-token-create");

  const response = await passwordResetRequest(
    postJson({ email: "transaction-failure@example.com" })
  );

  assert.deepEqual(await response.json(), { success: true });
  assert.equal(__getPasswordResetTokens().length, 0);
  assert.equal(__getSentEmails().length, 0);
});

test("email delivery failure leaves the committed reset token recoverable after cooldown", async () => {
  __seedUser({ email: "delivery-failure@example.com", password: "hashed" });
  __failNextSend();

  const response = await passwordResetRequest(
    postJson({ email: "delivery-failure@example.com" })
  );

  assert.deepEqual(await response.json(), { success: true });
  assert.equal(__getPasswordResetTokens().length, 1);
  assert.equal(__getSentEmails().length, 0);
});
