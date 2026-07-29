import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { before, beforeEach, test } from "node:test";
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

test("successful confirmation claims the submitted token and invalidates sibling grants", async () => {
  const user = await seedUserWithToken();
  const sibling = __seedPasswordResetToken({
    userId: user.id,
    tokenHash: hashValue("sibling-token"),
  });

  const response = await passwordResetConfirm(
    postJson({
      email: "reset@example.com",
      token: RAW_TOKEN,
      password: "brand-new-password-1",
    })
  );

  assert.equal(response.status, 200);
  assert.ok(__getPasswordResetTokens().every((token) => token.usedAt !== null));
  assert.ok(sibling.usedAt);
});

test("a forced password update failure rolls back the submitted-token claim", async () => {
  const user = await seedUserWithToken();
  __failNextDbOperation("user-update");

  await assert.rejects(
    passwordResetConfirm(
      postJson({
        email: "reset@example.com",
        token: RAW_TOKEN,
        password: "brand-new-password-1",
      })
    )
  );

  assert.equal(__getPasswordResetTokens()[0].usedAt, null);
  assert.ok(await bcrypt.compare("old-password-1", user.password ?? ""));
});

test("a forced sibling invalidation failure rolls back the claim and password update", async () => {
  const user = await seedUserWithToken({ mustResetPassword: true });
  __seedPasswordResetToken({
    userId: user.id,
    tokenHash: hashValue("sibling-token"),
  });
  __failNextDbOperation("password-reset-token-sibling-update");

  await assert.rejects(
    passwordResetConfirm(
      postJson({
        email: "reset@example.com",
        token: RAW_TOKEN,
        password: "brand-new-password-1",
      })
    )
  );

  assert.ok(__getPasswordResetTokens().every((token) => token.usedAt === null));
  assert.ok(await bcrypt.compare("old-password-1", user.password ?? ""));
  assert.equal(user.mustResetPassword, true);
});

test("a duplicate confirmation reports exactly one success and cannot mutate twice", async () => {
  const user = await seedUserWithToken();
  const first = await passwordResetConfirm(
    postJson({
      email: "reset@example.com",
      token: RAW_TOKEN,
      password: "first-winning-password",
    })
  );
  const second = await passwordResetConfirm(
    postJson({
      email: "reset@example.com",
      token: RAW_TOKEN,
      password: "second-losing-password",
    })
  );

  assert.equal(first.status, 200);
  assert.equal(second.status, 400);
  assert.ok(await bcrypt.compare("first-winning-password", user.password ?? ""));
  assert.equal(await bcrypt.compare("second-losing-password", user.password ?? ""), false);
});

test("two concurrent submissions of one token produce exactly one successful password", async () => {
  const user = await seedUserWithToken();
  const requests = [
    {
      password: "concurrent-password-one",
      request: postJson({
        email: "reset@example.com",
        token: RAW_TOKEN,
        password: "concurrent-password-one",
      }),
    },
    {
      password: "concurrent-password-two",
      request: postJson({
        email: "reset@example.com",
        token: RAW_TOKEN,
        password: "concurrent-password-two",
      }),
    },
  ];

  const responses = await Promise.all(
    requests.map(({ request }) => passwordResetConfirm(request))
  );
  const winnerIndex = responses.findIndex((response) => response.status === 200);

  assert.equal(responses.filter((response) => response.status === 200).length, 1);
  assert.equal(responses.filter((response) => response.status === 400).length, 1);
  assert.ok(await bcrypt.compare(requests[winnerIndex].password, user.password ?? ""));
});

test("different active tokens racing for one user still produce one winner", async () => {
  const user = await seedUserWithToken();
  const secondRawToken = "another-valid-reset-token";
  __seedPasswordResetToken({
    userId: user.id,
    tokenHash: hashValue(secondRawToken),
  });
  const requests = [
    {
      password: "first-token-password",
      request: postJson({
        email: "reset@example.com",
        token: RAW_TOKEN,
        password: "first-token-password",
      }),
    },
    {
      password: "second-token-password",
      request: postJson({
        email: "reset@example.com",
        token: secondRawToken,
        password: "second-token-password",
      }),
    },
  ];

  const responses = await Promise.all(
    requests.map(({ request }) => passwordResetConfirm(request))
  );
  const winnerIndex = responses.findIndex((response) => response.status === 200);

  assert.equal(responses.filter((response) => response.status === 200).length, 1);
  assert.equal(responses.filter((response) => response.status === 400).length, 1);
  assert.ok(await bcrypt.compare(requests[winnerIndex].password, user.password ?? ""));
  assert.ok(__getPasswordResetTokens().every((token) => token.usedAt !== null));
});
