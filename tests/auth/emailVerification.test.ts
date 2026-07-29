import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { hashValue, VERIFICATION_CODE_MAX_ATTEMPTS } from "@/lib/auth-tokens";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic import below so `@/lib/db` resolves to the
// fake for every transitive import `email-verification.ts` performs.
registerAuthTestHooks();

import {
  __getUsers,
  __getVerificationCodes,
  __resetFakeDb,
  __runAfterNextVerificationCodeLookup,
  __seedUser,
  __seedVerificationCode,
  __simulateUnexpectedFailure,
} from "./testDoubles/fakeDb";

let attemptEmailVerification: typeof import("../../src/lib/email-verification").attemptEmailVerification;

beforeEach(async () => {
  __resetFakeDb();
  ({ attemptEmailVerification } = await import("../../src/lib/email-verification"));
});

const EMAIL = "learner@example.com";
const CODE = "1234";
const CODE_HASH = hashValue(CODE);

test("no active code returns failure", async () => {
  __seedUser({ email: EMAIL });

  const result = await attemptEmailVerification(EMAIL, CODE);

  assert.deepEqual(result, { success: false });
});

test("a padded, mixed-case direct call still resolves the canonical identity's active code", async () => {
  __seedUser({ email: EMAIL });
  const code = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });

  const result = await attemptEmailVerification(`  ${EMAIL.toUpperCase()} `, CODE);

  assert.deepEqual(result, { success: true });
  assert.ok(__getVerificationCodes().find((c) => c.id === code.id)?.usedAt);
});

test("an invalid raw email is rejected before any database lookup", async () => {
  __seedUser({ email: EMAIL });
  __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });

  const result = await attemptEmailVerification("not-an-email", CODE);

  assert.deepEqual(result, { success: false });
});

test("an expired code returns failure and performs no write", async () => {
  __seedUser({ email: EMAIL });
  const code = __seedVerificationCode({
    email: EMAIL,
    codeHash: CODE_HASH,
    expiresAt: new Date(Date.now() - 1000),
  });

  const result = await attemptEmailVerification(EMAIL, CODE);

  assert.deepEqual(result, { success: false });
  const stored = __getVerificationCodes().find((c) => c.id === code.id)!;
  assert.equal(stored.attempts, 0);
  assert.equal(stored.usedAt, null);
});

test("an already-used code is not found as active and returns failure", async () => {
  __seedUser({ email: EMAIL });
  const code = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });
  code.usedAt = new Date();

  const result = await attemptEmailVerification(EMAIL, CODE);

  assert.deepEqual(result, { success: false });
});

test("a wrong code below the limit increments attempts by exactly one and does not verify the user", async () => {
  __seedUser({ email: EMAIL });
  const code = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });

  const result = await attemptEmailVerification(EMAIL, "0000");

  assert.deepEqual(result, { success: false });
  assert.equal(__getVerificationCodes().find((c) => c.id === code.id)?.attempts, 1);
  assert.equal(__getUsers()[0].emailVerified, null);
});

test("the final allowed wrong attempt reaches but never exceeds the maximum", async () => {
  __seedUser({ email: EMAIL });
  const code = __seedVerificationCode({
    email: EMAIL,
    codeHash: CODE_HASH,
    attempts: VERIFICATION_CODE_MAX_ATTEMPTS - 1,
  });

  await attemptEmailVerification(EMAIL, "0000");
  assert.equal(
    __getVerificationCodes().find((c) => c.id === code.id)?.attempts,
    VERIFICATION_CODE_MAX_ATTEMPTS
  );

  // A further wrong attempt after the limit is reached must not increment
  // past it.
  await attemptEmailVerification(EMAIL, "0000");
  assert.equal(
    __getVerificationCodes().find((c) => c.id === code.id)?.attempts,
    VERIFICATION_CODE_MAX_ATTEMPTS
  );
});

test("a wrong code submitted after exhaustion performs no write", async () => {
  __seedUser({ email: EMAIL });
  const code = __seedVerificationCode({
    email: EMAIL,
    codeHash: CODE_HASH,
    attempts: VERIFICATION_CODE_MAX_ATTEMPTS,
  });

  const result = await attemptEmailVerification(EMAIL, "0000");

  assert.deepEqual(result, { success: false });
  assert.equal(__getVerificationCodes().find((c) => c.id === code.id)?.attempts, VERIFICATION_CODE_MAX_ATTEMPTS);
});

test("a correct code below the limit verifies the user and consumes the code exactly once", async () => {
  __seedUser({ email: EMAIL });
  const code = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });

  const result = await attemptEmailVerification(EMAIL, CODE);

  assert.deepEqual(result, { success: true });
  assert.ok(__getUsers()[0].emailVerified);
  assert.equal(__getUsers()[0].onboardingStep, "WELCOME_VIDEO");
  assert.ok(__getVerificationCodes().find((c) => c.id === code.id)?.usedAt);
});

test("a correct code for an account already past VERIFY_EMAIL rolls back and fails without moving the account", async () => {
  __seedUser({ email: EMAIL, onboardingStep: "PROFILE", emailVerified: null });
  const code = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });

  const result = await attemptEmailVerification(EMAIL, CODE);

  assert.deepEqual(result, { success: false });
  assert.equal(__getUsers()[0].onboardingStep, "PROFILE");
  assert.equal(__getUsers()[0].emailVerified, null);
  assert.equal(
    __getVerificationCodes().find((c) => c.id === code.id)?.usedAt,
    null,
    "the code claim must roll back with the rejected user match"
  );
});

test("a correct code for an already-completed account rolls back and fails", async () => {
  __seedUser({
    email: EMAIL,
    onboardingStep: "COMPLETE",
    onboardingCompleted: true,
    emailVerified: null,
  });
  const code = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });

  const result = await attemptEmailVerification(EMAIL, CODE);

  assert.deepEqual(result, { success: false });
  assert.equal(__getUsers()[0].emailVerified, null);
  assert.equal(__getVerificationCodes().find((c) => c.id === code.id)?.usedAt, null);
});

test("a correct code for a database child account rolls back and fails", async () => {
  __seedUser({ email: EMAIL, role: "CHILD" });
  const code = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });

  const result = await attemptEmailVerification(EMAIL, CODE);

  assert.deepEqual(result, { success: false });
  assert.equal(__getUsers()[0].emailVerified, null);
  assert.equal(__getVerificationCodes().find((c) => c.id === code.id)?.usedAt, null);
});

test("a correct code with no matching user rolls back and fails", async () => {
  const code = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });

  const result = await attemptEmailVerification(EMAIL, CODE);

  assert.deepEqual(result, { success: false });
  assert.equal(__getVerificationCodes().find((c) => c.id === code.id)?.usedAt, null);
});

test("a code superseded between lookup and claim loses the race and leaves the replacement untouched", async () => {
  __seedUser({ email: EMAIL });
  const oldCode = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });
  let replacement!: ReturnType<typeof __seedVerificationCode>;

  // Fires inside the lookup, in the real gap between `findFirst` and the
  // conditional claim: models a resend request that invalidates this exact
  // row and creates its replacement after this request already captured
  // `oldCode` as the active row but before it claims it.
  __runAfterNextVerificationCodeLookup(() => {
    oldCode.usedAt = new Date();
    replacement = __seedVerificationCode({
      email: EMAIL,
      codeHash: hashValue("5678"),
      createdAt: new Date(oldCode.createdAt.getTime() + 1000),
    });
  });

  const result = await attemptEmailVerification(EMAIL, CODE);

  assert.deepEqual(result, { success: false });
  assert.equal(__getUsers()[0].emailVerified, null);
  assert.equal(__getUsers()[0].onboardingStep, "VERIFY_EMAIL");
  const storedReplacement = __getVerificationCodes().find((c) => c.id === replacement.id)!;
  assert.equal(storedReplacement.usedAt, null, "the replacement must remain unused");
  assert.equal(storedReplacement.attempts, 0, "the replacement must not record an attempt");
});

test("a correct code submitted after exhaustion is rejected", async () => {
  __seedUser({ email: EMAIL });
  const code = __seedVerificationCode({
    email: EMAIL,
    codeHash: CODE_HASH,
    attempts: VERIFICATION_CODE_MAX_ATTEMPTS,
  });

  const result = await attemptEmailVerification(EMAIL, CODE);

  assert.deepEqual(result, { success: false });
  assert.equal(__getVerificationCodes().find((c) => c.id === code.id)?.usedAt, null);
});

test("a duplicate correct submission of an already-consumed code fails", async () => {
  __seedUser({ email: EMAIL });
  __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });

  const first = await attemptEmailVerification(EMAIL, CODE);
  const second = await attemptEmailVerification(EMAIL, CODE);

  assert.deepEqual(first, { success: true });
  assert.deepEqual(second, { success: false });
});

test("two concurrent correct submissions leave exactly one winning commit and fully consistent state", async () => {
  __seedUser({ email: EMAIL });
  const code = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });

  const [first, second] = await Promise.all([
    attemptEmailVerification(EMAIL, CODE),
    attemptEmailVerification(EMAIL, CODE),
  ]);

  const results = [first, second];
  assert.equal(
    results.filter((result) => result.success).length,
    1,
    "exactly one concurrent correct submission may succeed"
  );
  assert.equal(
    results.filter((result) => !result.success).length,
    1,
    "exactly one concurrent correct submission must fail"
  );

  const storedCode = __getVerificationCodes().find((c) => c.id === code.id)!;
  assert.ok(storedCode.usedAt, "the code must be consumed exactly once");

  const user = __getUsers()[0];
  assert.ok(user.emailVerified, "the losing rollback must not erase the winner's verification");
  assert.equal(user.onboardingStep, "WELCOME_VIDEO", "the winner's onboarding advance must survive");
  assert.equal(user.onboardingCompleted, false, "onboarding must remain incomplete");
});

test("a concurrent correct and wrong submission do not corrupt each other's state", async () => {
  __seedUser({ email: EMAIL });
  const code = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });

  const [correct, wrong] = await Promise.all([
    attemptEmailVerification(EMAIL, CODE),
    attemptEmailVerification(EMAIL, "0000"),
  ]);

  assert.deepEqual(correct, { success: true });
  assert.deepEqual(wrong, { success: false });
  const stored = __getVerificationCodes().find((c) => c.id === code.id)!;
  assert.ok(stored.usedAt, "the correct submission must still consume the code");
  assert.equal(
    stored.attempts,
    0,
    "a wrong submission racing a code that just got consumed must not still record an attempt"
  );
});

test("an unexpected failure while advancing onboarding rolls back code consumption", async () => {
  __seedUser({ email: EMAIL });
  const code = __seedVerificationCode({ email: EMAIL, codeHash: CODE_HASH });
  __simulateUnexpectedFailure();

  await assert.rejects(() => attemptEmailVerification(EMAIL, CODE));

  const stored = __getVerificationCodes().find((c) => c.id === code.id)!;
  assert.equal(stored.usedAt, null, "the code claim must roll back with the failed transaction");
  assert.equal(__getUsers()[0].emailVerified, null);
});
