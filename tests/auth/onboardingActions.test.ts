import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic imports below so `@/lib/db` and `next-auth`
// resolve to the fakes for every transitive import the actions perform.
registerAuthTestHooks();

import {
  __getParentStudents,
  __getUsers,
  __resetFakeDb,
  __seedUser,
} from "./testDoubles/fakeDb";
import { __setSessionUserId } from "./testDoubles/fakeNextAuth";

let onboardingActions: typeof import("../../src/actions/onboarding");

before(async () => {
  onboardingActions = await import("../../src/actions/onboarding");
});

beforeEach(() => {
  __resetFakeDb();
  __setSessionUserId(undefined);
});

function seedParent(onboardingStep: string, overrides: Record<string, unknown> = {}) {
  return __seedUser({ role: "PARENT", onboardingStep, ...overrides });
}

// --- Unauthenticated rejection -------------------------------------------

test("every onboarding action rejects an unauthenticated caller", async () => {
  const { completeWelcomeVideoStep, saveProfile, continueWithFreeTrial, checkUsernameAvailability, suggestUsernames, createChildAccount, finishChildrenStep } =
    onboardingActions;

  assert.deepEqual(await completeWelcomeVideoStep(), { status: "unauthenticated" });
  assert.deepEqual(await saveProfile({ fName: "Ada" }), { status: "unauthenticated" });
  assert.deepEqual(await continueWithFreeTrial(), { status: "unauthenticated" });
  assert.deepEqual(await checkUsernameAvailability("student1"), { status: "unauthenticated" });
  assert.deepEqual(await suggestUsernames("student"), { status: "unauthenticated" });
  assert.deepEqual(
    await createChildAccount({
      firstName: "Kid",
      username: "kid123",
      password: "password123",
      mustResetPassword: false,
    }),
    { status: "unauthenticated" }
  );
  assert.deepEqual(await finishChildrenStep(), { status: "unauthenticated" });
});

// --- Database-role rejection ----------------------------------------------

test("a database CHILD role cannot invoke parent onboarding actions", async () => {
  const child = __seedUser({ role: "CHILD", onboardingStep: "WELCOME_VIDEO" });
  __setSessionUserId(child.id);

  const result = await onboardingActions.completeWelcomeVideoStep();

  assert.equal(result.status, "recovery");
  assert.equal(__getUsers()[0].onboardingStep, "WELCOME_VIDEO");
});

// --- Welcome video ----------------------------------------------------------

test("completeWelcomeVideoStep succeeds only from the exact stored step and does not repeat", async () => {
  const parent = seedParent("WELCOME_VIDEO");
  __setSessionUserId(parent.id);

  const first = await onboardingActions.completeWelcomeVideoStep();
  assert.deepEqual(first, { status: "success", data: undefined });
  assert.equal(__getUsers()[0].onboardingStep, "PROFILE");

  const repeated = await onboardingActions.completeWelcomeVideoStep();
  assert.equal(repeated.status, "recovery");
  assert.equal(__getUsers()[0].onboardingStep, "PROFILE", "must not advance past PROFILE");
});

test("completeWelcomeVideoStep from an earlier or later step recovers instead of advancing", async () => {
  const early = seedParent("VERIFY_EMAIL");
  __setSessionUserId(early.id);
  const earlyResult = await onboardingActions.completeWelcomeVideoStep();
  assert.deepEqual(earlyResult, { status: "recovery", redirectTo: "/verify-email" });

  const late = seedParent("PLAN");
  __setSessionUserId(late.id);
  const lateResult = await onboardingActions.completeWelcomeVideoStep();
  assert.equal(lateResult.status, "recovery");
  assert.equal(__getUsers().find((u) => u.id === late.id)?.onboardingStep, "PLAN");
});

test("completeWelcomeVideoStep after completion recovers to /dashboard", async () => {
  const done = seedParent("COMPLETE", { onboardingCompleted: true });
  __setSessionUserId(done.id);

  const result = await onboardingActions.completeWelcomeVideoStep();

  assert.deepEqual(result, { status: "recovery", redirectTo: "/dashboard" });
});

// --- Profile -----------------------------------------------------------------

test("saveProfile writes the profile fields and PROFILE -> PLAN atomically", async () => {
  const parent = seedParent("PROFILE");
  __setSessionUserId(parent.id);

  const result = await onboardingActions.saveProfile({ fName: "Ada", lName: "Lovelace" });

  assert.deepEqual(result, { status: "success", data: undefined });
  const stored = __getUsers()[0];
  assert.equal(stored.onboardingStep, "PLAN");
  assert.equal(stored.fName, "Ada");
  assert.equal(stored.name, "Ada Lovelace");
});

test("saveProfile rejects invalid input before touching the database", async () => {
  const parent = seedParent("PROFILE");
  __setSessionUserId(parent.id);

  const result = await onboardingActions.saveProfile({ fName: "" });

  assert.equal(result.status, "error");
  assert.equal(__getUsers()[0].onboardingStep, "PROFILE");
});

test("saveProfile rejects a database CHILD role without writing profile data", async () => {
  const child = __seedUser({ role: "CHILD", onboardingStep: "PROFILE", fName: "Old" });
  __setSessionUserId(child.id);

  const result = await onboardingActions.saveProfile({ fName: "New" });

  assert.equal(result.status, "recovery");
  assert.equal(__getUsers()[0].fName, "Old", "no profile write may survive an unauthorized caller");
  assert.equal(__getUsers()[0].onboardingStep, "PROFILE");
});

test("saveProfile called from an earlier or later stored step recovers without writing profile data", async () => {
  const early = seedParent("WELCOME_VIDEO", { fName: "Old" });
  __setSessionUserId(early.id);
  const earlyResult = await onboardingActions.saveProfile({ fName: "New" });
  assert.equal(earlyResult.status, "recovery");
  assert.equal(__getUsers().find((u) => u.id === early.id)?.fName, "Old");

  const late = seedParent("PLAN", { fName: "Old" });
  __setSessionUserId(late.id);
  const lateResult = await onboardingActions.saveProfile({ fName: "New" });
  assert.equal(lateResult.status, "recovery");
  assert.equal(__getUsers().find((u) => u.id === late.id)?.fName, "Old");
});

test("saveProfile rejects a completed account without writing profile data", async () => {
  const done = seedParent("COMPLETE", { onboardingCompleted: true, fName: "Old" });
  __setSessionUserId(done.id);

  const result = await onboardingActions.saveProfile({ fName: "New" });

  assert.deepEqual(result, { status: "recovery", redirectTo: "/dashboard" });
  assert.equal(__getUsers()[0].fName, "Old");
});

// --- Plan / free trial ---------------------------------------------------

test("continueWithFreeTrial advances PLAN -> CHILDREN only from PLAN", async () => {
  const parent = seedParent("PLAN");
  __setSessionUserId(parent.id);

  const result = await onboardingActions.continueWithFreeTrial();

  assert.deepEqual(result, { status: "success", data: undefined });
  assert.equal(__getUsers()[0].onboardingStep, "CHILDREN");
});

test("continueWithFreeTrial rejects a database CHILD role without advancing", async () => {
  const child = __seedUser({ role: "CHILD", onboardingStep: "PLAN" });
  __setSessionUserId(child.id);

  const result = await onboardingActions.continueWithFreeTrial();

  assert.equal(result.status, "recovery");
  assert.equal(__getUsers()[0].onboardingStep, "PLAN");
});

test("continueWithFreeTrial called from an earlier or later stored step recovers instead of advancing", async () => {
  const early = seedParent("PROFILE");
  __setSessionUserId(early.id);
  const earlyResult = await onboardingActions.continueWithFreeTrial();
  assert.equal(earlyResult.status, "recovery");
  assert.equal(__getUsers().find((u) => u.id === early.id)?.onboardingStep, "PROFILE");

  const late = seedParent("CHILDREN");
  __setSessionUserId(late.id);
  const lateResult = await onboardingActions.continueWithFreeTrial();
  assert.equal(lateResult.status, "recovery");
  assert.equal(__getUsers().find((u) => u.id === late.id)?.onboardingStep, "CHILDREN");
});

test("continueWithFreeTrial rejects a completed account without advancing", async () => {
  const done = seedParent("COMPLETE", { onboardingCompleted: true });
  __setSessionUserId(done.id);

  const result = await onboardingActions.continueWithFreeTrial();

  assert.deepEqual(result, { status: "recovery", redirectTo: "/dashboard" });
});

// --- Username availability / suggestions ----------------------------------

test("checkUsernameAvailability and suggestUsernames are rejected outside CHILDREN", async () => {
  const parent = seedParent("PLAN");
  __setSessionUserId(parent.id);

  const availability = await onboardingActions.checkUsernameAvailability("student1");
  const suggestions = await onboardingActions.suggestUsernames("student");

  assert.notEqual(availability.status, "success");
  assert.notEqual(suggestions.status, "success");
});

test("checkUsernameAvailability and suggestUsernames are rejected for a database CHILD role", async () => {
  const child = __seedUser({ role: "CHILD", onboardingStep: "CHILDREN" });
  __setSessionUserId(child.id);

  const availability = await onboardingActions.checkUsernameAvailability("student1");
  const suggestions = await onboardingActions.suggestUsernames("student");

  assert.notEqual(availability.status, "success");
  assert.notEqual(suggestions.status, "success");
});

test("checkUsernameAvailability and suggestUsernames are rejected for a completed account", async () => {
  const done = seedParent("COMPLETE", { onboardingCompleted: true });
  __setSessionUserId(done.id);

  const availability = await onboardingActions.checkUsernameAvailability("student1");
  const suggestions = await onboardingActions.suggestUsernames("student");

  assert.deepEqual(availability, { status: "recovery", redirectTo: "/dashboard" });
  assert.deepEqual(suggestions, { status: "recovery", redirectTo: "/dashboard" });
});

test("checkUsernameAvailability reports taken and available usernames while on CHILDREN", async () => {
  const parent = seedParent("CHILDREN");
  __setSessionUserId(parent.id);
  __seedUser({ role: "CHILD", onboardingStep: "COMPLETE", username: "taken1" });

  const taken = await onboardingActions.checkUsernameAvailability("taken1");
  const free = await onboardingActions.checkUsernameAvailability("brandnew1");

  assert.deepEqual(taken, { status: "success", data: { available: false } });
  assert.deepEqual(free, { status: "success", data: { available: true } });
});

// --- Child creation ---------------------------------------------------------

test("createChildAccount is rejected outside CHILDREN and for a non-parent role", async () => {
  const parentOnPlan = seedParent("PLAN");
  __setSessionUserId(parentOnPlan.id);
  const rejectedByStep = await onboardingActions.createChildAccount({
    firstName: "Kid",
    username: "kid001",
    password: "password123",
    mustResetPassword: false,
  });
  assert.notEqual(rejectedByStep.status, "success");
  assert.equal(__getParentStudents().length, 0);

  const child = __seedUser({ role: "CHILD", onboardingStep: "CHILDREN" });
  __setSessionUserId(child.id);
  const rejectedByRole = await onboardingActions.createChildAccount({
    firstName: "Kid",
    username: "kid002",
    password: "password123",
    mustResetPassword: false,
  });
  assert.notEqual(rejectedByRole.status, "success");
  assert.equal(__getParentStudents().length, 0);
});

test("createChildAccount is rejected for a completed account", async () => {
  const done = seedParent("COMPLETE", { onboardingCompleted: true });
  __setSessionUserId(done.id);

  const result = await onboardingActions.createChildAccount({
    firstName: "Kid",
    username: "kid003",
    password: "password123",
    mustResetPassword: false,
  });

  assert.deepEqual(result, { status: "recovery", redirectTo: "/dashboard" });
  assert.equal(__getParentStudents().length, 0);
});

test("createChildAccount preserves ownership and enforces the two-child limit", async () => {
  const parent = seedParent("CHILDREN");
  __setSessionUserId(parent.id);

  const first = await onboardingActions.createChildAccount({
    firstName: "First",
    username: "childone",
    password: "password123",
    mustResetPassword: false,
  });
  const second = await onboardingActions.createChildAccount({
    firstName: "Second",
    username: "childtwo",
    password: "password123",
    mustResetPassword: false,
  });
  const third = await onboardingActions.createChildAccount({
    firstName: "Third",
    username: "childthree",
    password: "password123",
    mustResetPassword: false,
  });

  assert.equal(first.status, "success");
  assert.equal(second.status, "success");
  assert.equal(third.status, "error");
  assert.equal(__getParentStudents().length, 2, "the parent may own at most two children");
  assert.ok(__getParentStudents().every((row) => row.parentId === parent.id));
});

test("concurrent child-creation requests for the same parent never exceed the two-child limit", async () => {
  const parent = seedParent("CHILDREN");
  __setSessionUserId(parent.id);
  // Already at one child; two concurrent requests race for the second slot.
  await onboardingActions.createChildAccount({
    firstName: "First",
    username: "raceone",
    password: "password123",
    mustResetPassword: false,
  });

  const [a, b] = await Promise.all([
    onboardingActions.createChildAccount({
      firstName: "Second",
      username: "racetwo",
      password: "password123",
      mustResetPassword: false,
    }),
    onboardingActions.createChildAccount({
      firstName: "Third",
      username: "racethree",
      password: "password123",
      mustResetPassword: false,
    }),
  ]);

  const successes = [a, b].filter((result) => result.status === "success");
  assert.equal(successes.length, 1, "only one of the two concurrent requests may succeed");
  assert.equal(__getParentStudents().length, 2, "the limit must hold under concurrency");
});

test("createChildAccount returns a safe conflict for a taken username", async () => {
  const parent = seedParent("CHILDREN");
  __setSessionUserId(parent.id);
  __seedUser({ role: "CHILD", onboardingStep: "COMPLETE", username: "dupeuser" });

  const result = await onboardingActions.createChildAccount({
    firstName: "Kid",
    username: "dupeuser",
    password: "password123",
    mustResetPassword: false,
  });

  assert.equal(result.status, "error");
});

// --- Finish children step ---------------------------------------------------

test("finishChildrenStep atomically completes onboarding", async () => {
  const parent = seedParent("CHILDREN");
  __setSessionUserId(parent.id);

  const result = await onboardingActions.finishChildrenStep();

  assert.deepEqual(result, { status: "success", data: undefined });
  const stored = __getUsers()[0];
  assert.equal(stored.onboardingStep, "COMPLETE");
  assert.equal(stored.onboardingCompleted, true);
});

test("finishChildrenStep cannot be repeated after completion", async () => {
  const parent = seedParent("CHILDREN");
  __setSessionUserId(parent.id);

  await onboardingActions.finishChildrenStep();
  const repeated = await onboardingActions.finishChildrenStep();

  assert.equal(repeated.status, "recovery");
});

test("finishChildrenStep rejects a database CHILD role without completing onboarding", async () => {
  const child = __seedUser({ role: "CHILD", onboardingStep: "CHILDREN" });
  __setSessionUserId(child.id);

  const result = await onboardingActions.finishChildrenStep();

  assert.equal(result.status, "recovery");
  assert.equal(__getUsers()[0].onboardingStep, "CHILDREN");
  assert.equal(__getUsers()[0].onboardingCompleted, false);
});

test("finishChildrenStep called from an earlier stored step recovers without completing onboarding", async () => {
  const parent = seedParent("PLAN");
  __setSessionUserId(parent.id);

  const result = await onboardingActions.finishChildrenStep();

  assert.equal(result.status, "recovery");
  assert.equal(__getUsers()[0].onboardingStep, "PLAN");
  assert.equal(__getUsers()[0].onboardingCompleted, false);
});

// --- Full normal sequence ----------------------------------------------------

test("a parent can complete the full funnel in the intended order without regression", async () => {
  const parent = seedParent("VERIFY_EMAIL");
  __setSessionUserId(parent.id);

  // VERIFY_EMAIL -> WELCOME_VIDEO happens via the email-verification route in
  // production; the funnel-owned steps are exercised here directly.
  __getUsers()[0].onboardingStep = "WELCOME_VIDEO";

  assert.equal((await onboardingActions.completeWelcomeVideoStep()).status, "success");
  assert.equal(
    (await onboardingActions.saveProfile({ fName: "Ada" })).status,
    "success"
  );
  assert.equal((await onboardingActions.continueWithFreeTrial()).status, "success");
  assert.equal(
    (
      await onboardingActions.createChildAccount({
        firstName: "Kid",
        username: "finalkid",
        password: "password123",
        mustResetPassword: false,
      })
    ).status,
    "success"
  );
  assert.equal((await onboardingActions.finishChildrenStep()).status, "success");

  const stored = __getUsers().find((user) => user.id === parent.id);
  assert.equal(stored?.onboardingStep, "COMPLETE");
  assert.equal(stored?.onboardingCompleted, true);
});
