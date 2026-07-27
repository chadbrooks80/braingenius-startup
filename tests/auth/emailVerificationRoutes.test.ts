import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { hashValue, VERIFICATION_CODE_MAX_ATTEMPTS } from "@/lib/auth-tokens";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic imports below so `@/lib/db` and `@/lib/email`
// resolve to the fakes for every transitive import the route files perform.
registerAuthTestHooks();

import {
  __getUsers,
  __getVerificationCodes,
  __resetFakeDb,
  __seedUser,
  __seedVerificationCode,
} from "./testDoubles/fakeDb";
import { __getSentEmails, __resetFakeEmail } from "./testDoubles/fakeEmail";

let verifyEmailCode: typeof import("../../src/app/api/auth/verify-email-code/route").POST;
let resendVerificationCode: typeof import("../../src/app/api/auth/resend-verification-code/route").POST;

before(async () => {
  ({ POST: verifyEmailCode } = await import("../../src/app/api/auth/verify-email-code/route"));
  ({ POST: resendVerificationCode } = await import(
    "../../src/app/api/auth/resend-verification-code/route"
  ));
});

beforeEach(() => {
  __resetFakeDb();
  __resetFakeEmail();
});

function postJson(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VERIFY_URL = "http://localhost/api/auth/verify-email-code";
const RESEND_URL = "http://localhost/api/auth/resend-verification-code";

test("verify-email-code: malformed request body returns a distinct 400", async () => {
  const response = await verifyEmailCode(
    new NextRequest(VERIFY_URL, { method: "POST", body: "not json" })
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { success: false, error: "Invalid request." });
});

test("verify-email-code: no active code, wrong code, expired code, and exhausted attempts share one identical response", async () => {
  const codeHash = hashValue("1234");

  __seedVerificationCode({ email: "no-code@example.com", codeHash: hashValue("0000") });
  // Immediately mark it used so no *active* code exists for this email.
  __getVerificationCodes()[0].usedAt = new Date();

  __seedUser({ email: "wrong-code@example.com" });
  __seedVerificationCode({ email: "wrong-code@example.com", codeHash });

  __seedUser({ email: "expired@example.com" });
  __seedVerificationCode({
    email: "expired@example.com",
    codeHash,
    expiresAt: new Date(Date.now() - 1000),
  });

  __seedUser({ email: "exhausted@example.com" });
  __seedVerificationCode({
    email: "exhausted@example.com",
    codeHash,
    attempts: VERIFICATION_CODE_MAX_ATTEMPTS,
  });

  const cases = [
    { email: "no-code@example.com", code: "1234" },
    { email: "wrong-code@example.com", code: "9999" },
    { email: "expired@example.com", code: "1234" },
    { email: "exhausted@example.com", code: "1234" },
  ];

  const responses = await Promise.all(
    cases.map(async ({ email, code }) => {
      const response = await verifyEmailCode(postJson(VERIFY_URL, { email, code }));
      return { status: response.status, body: await response.json() };
    })
  );

  const [first, ...rest] = responses;
  for (const response of rest) {
    assert.deepEqual(response, first);
  }
  assert.equal(first.status, 400);
  assert.equal(first.body.success, false);
});

test("verify-email-code: an incorrect active code increments attempts but does not verify the user", async () => {
  __seedUser({ email: "wrong@example.com" });
  const code = __seedVerificationCode({ email: "wrong@example.com", codeHash: hashValue("1234") });

  await verifyEmailCode(postJson(VERIFY_URL, { email: "wrong@example.com", code: "0000" }));

  assert.equal(__getVerificationCodes().find((c) => c.id === code.id)?.attempts, 1);
  assert.equal(__getUsers()[0].emailVerified, null);
});

test("verify-email-code: a correct active code verifies the user and consumes the code", async () => {
  __seedUser({ email: "correct@example.com" });
  const code = __seedVerificationCode({
    email: "correct@example.com",
    codeHash: hashValue("1234"),
  });

  const response = await verifyEmailCode(
    postJson(VERIFY_URL, { email: "correct@example.com", code: "1234" })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.ok(__getUsers()[0].emailVerified, "user must be marked verified");
  assert.ok(
    __getVerificationCodes().find((c) => c.id === code.id)?.usedAt,
    "the code must be marked used"
  );
});

test("resend-verification-code: malformed, unknown, verified, cooldown, and eligible requests all return the identical generic response", async () => {
  __seedUser({ email: "verified@example.com", emailVerified: new Date() });

  __seedUser({ email: "cooldown@example.com" });
  __seedVerificationCode({ email: "cooldown@example.com", codeHash: hashValue("1234") });

  __seedUser({ email: "eligible@example.com" });

  const responses = await Promise.all(
    [
      postJson(RESEND_URL, { email: "not-an-email" }),
      postJson(RESEND_URL, { email: "unknown@example.com" }),
      postJson(RESEND_URL, { email: "verified@example.com" }),
      postJson(RESEND_URL, { email: "cooldown@example.com" }),
      postJson(RESEND_URL, { email: "eligible@example.com" }),
    ].map(async (request) => {
      const response = await resendVerificationCode(request);
      return { status: response.status, body: await response.json() };
    })
  );

  for (const response of responses) {
    assert.deepEqual(response, { status: 200, body: { success: true } });
  }
});

test("resend-verification-code: a cooldown-active request performs no code creation or delivery", async () => {
  __seedUser({ email: "cooldown@example.com" });
  __seedVerificationCode({ email: "cooldown@example.com", codeHash: hashValue("1234") });

  await resendVerificationCode(postJson(RESEND_URL, { email: "cooldown@example.com" }));

  assert.equal(__getVerificationCodes().length, 1, "no additional code may be created");
  assert.equal(__getSentEmails().length, 0);
});

test("resend-verification-code: an eligible unverified account invalidates old codes, creates one new code, and attempts one delivery", async () => {
  __seedUser({ email: "eligible@example.com" });
  const staleCode = __seedVerificationCode({
    email: "eligible@example.com",
    codeHash: hashValue("0000"),
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
  });

  const response = await resendVerificationCode(
    postJson(RESEND_URL, { email: "eligible@example.com" })
  );
  const body = await response.json();

  assert.deepEqual(body, { success: true });
  assert.deepEqual(Object.keys(body), ["success"], "no code, password, or record may leak into the response");

  const codes = __getVerificationCodes();
  assert.equal(codes.length, 2);
  assert.ok(codes.find((c) => c.id === staleCode.id)?.usedAt, "the stale code must be invalidated");
  const freshCode = codes.find((c) => c.id !== staleCode.id);
  assert.ok(freshCode && !freshCode.usedAt);

  assert.equal(__getSentEmails().length, 1);
  assert.equal(__getSentEmails()[0].email, "eligible@example.com");
});
