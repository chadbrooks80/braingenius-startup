import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic import below so `@/lib/db` resolves to the
// fake for every transitive import the funnel module performs.
registerAuthTestHooks();

import {
  __getUsers,
  __resetFakeDb,
  __seedUser,
  __simulateUnexpectedFailure,
} from "./testDoubles/fakeDb";

let onboardingFunnel: typeof import("../../src/lib/onboarding-funnel");

before(async () => {
  onboardingFunnel = await import("../../src/lib/onboarding-funnel");
});

beforeEach(() => {
  __resetFakeDb();
});

test("getNextOnboardingStep advances through the funnel in order and stops at COMPLETE", () => {
  const { getNextOnboardingStep } = onboardingFunnel;

  assert.equal(getNextOnboardingStep("VERIFY_EMAIL"), "WELCOME_VIDEO");
  assert.equal(getNextOnboardingStep("WELCOME_VIDEO"), "PROFILE");
  assert.equal(getNextOnboardingStep("PROFILE"), "PLAN");
  assert.equal(getNextOnboardingStep("PLAN"), "CHILDREN");
  assert.equal(getNextOnboardingStep("CHILDREN"), "COMPLETE");
  assert.equal(getNextOnboardingStep("COMPLETE"), "COMPLETE");
});

test("getOnboardingRoute routes by completion state and step", () => {
  const { getOnboardingRoute } = onboardingFunnel;

  assert.equal(
    getOnboardingRoute({ role: "PARENT", onboardingStep: "VERIFY_EMAIL", onboardingCompleted: false }),
    "/verify-email"
  );
  assert.equal(
    getOnboardingRoute({ role: "PARENT", onboardingStep: "PROFILE", onboardingCompleted: false }),
    "/getting-started"
  );
  assert.equal(
    getOnboardingRoute({ role: "PARENT", onboardingStep: "COMPLETE", onboardingCompleted: false }),
    "/dashboard"
  );
  assert.equal(
    getOnboardingRoute({ role: "PARENT", onboardingStep: "CHILDREN", onboardingCompleted: true }),
    "/dashboard"
  );
});

test("getOnboardingRoute always routes a CHILD role to /dashboard, ignoring its default onboarding fields", () => {
  const { getOnboardingRoute } = onboardingFunnel;

  assert.equal(
    getOnboardingRoute({ role: "CHILD", onboardingStep: "VERIFY_EMAIL", onboardingCompleted: false }),
    "/dashboard"
  );
});

test("advanceParentOnboardingStep succeeds and writes the next step atomically when state matches", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "WELCOME_VIDEO" });

  const result = await onboardingFunnel.advanceParentOnboardingStep(user.id, "WELCOME_VIDEO");

  assert.deepEqual(result, { status: "success", data: undefined });
  assert.equal(__getUsers()[0].onboardingStep, "PROFILE");
  assert.equal(__getUsers()[0].onboardingCompleted, false);
});

test("advanceParentOnboardingStep sets onboardingCompleted when the funnel reaches COMPLETE", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "CHILDREN" });

  const result = await onboardingFunnel.advanceParentOnboardingStep(user.id, "CHILDREN");

  assert.deepEqual(result, { status: "success", data: undefined });
  assert.equal(__getUsers()[0].onboardingStep, "COMPLETE");
  assert.equal(__getUsers()[0].onboardingCompleted, true);
});

test("advanceParentOnboardingStep rejects a database child role and recovers without changing state", async () => {
  const user = __seedUser({ role: "CHILD", onboardingStep: "WELCOME_VIDEO" });

  const result = await onboardingFunnel.advanceParentOnboardingStep(user.id, "WELCOME_VIDEO");

  assert.equal(result.status, "recovery");
  assert.equal(__getUsers()[0].onboardingStep, "WELCOME_VIDEO", "child row must not be advanced");
});

test("advanceParentOnboardingStep called from an earlier stored step recovers to the current route", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "WELCOME_VIDEO" });

  // Caller claims the user is already on PROFILE; the database disagrees.
  const result = await onboardingFunnel.advanceParentOnboardingStep(user.id, "PROFILE");

  assert.deepEqual(result, { status: "recovery", redirectTo: "/getting-started" });
  assert.equal(__getUsers()[0].onboardingStep, "WELCOME_VIDEO");
});

test("advanceParentOnboardingStep called from an already-passed step does not move the user backward", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "PLAN" });

  // A stale tab still thinks the user is on WELCOME_VIDEO.
  const result = await onboardingFunnel.advanceParentOnboardingStep(user.id, "WELCOME_VIDEO");

  assert.equal(result.status, "recovery");
  assert.equal(__getUsers()[0].onboardingStep, "PLAN", "step must not move backward");
});

test("advanceParentOnboardingStep called after completion recovers to /dashboard", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "COMPLETE", onboardingCompleted: true });

  const result = await onboardingFunnel.advanceParentOnboardingStep(user.id, "CHILDREN");

  assert.deepEqual(result, { status: "recovery", redirectTo: "/dashboard" });
});

test("a duplicate request after a successful transition does not advance the next step", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "WELCOME_VIDEO" });

  const first = await onboardingFunnel.advanceParentOnboardingStep(user.id, "WELCOME_VIDEO");
  const second = await onboardingFunnel.advanceParentOnboardingStep(user.id, "WELCOME_VIDEO");

  assert.equal(first.status, "success");
  assert.equal(second.status, "recovery");
  assert.equal(__getUsers()[0].onboardingStep, "PROFILE", "only the first request may advance");
});

test("two concurrent requests from the same step result in exactly one advancement", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "WELCOME_VIDEO" });

  const [first, second] = await Promise.all([
    onboardingFunnel.advanceParentOnboardingStep(user.id, "WELCOME_VIDEO"),
    onboardingFunnel.advanceParentOnboardingStep(user.id, "WELCOME_VIDEO"),
  ]);

  const outcomes = [first.status, second.status].sort();
  assert.deepEqual(outcomes, ["recovery", "success"]);
  assert.equal(__getUsers()[0].onboardingStep, "PROFILE", "the funnel may only move one step");
});

test("profile fields and the step advance are written by one conditional operation", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "PROFILE" });

  const result = await onboardingFunnel.advanceParentOnboardingStep(user.id, "PROFILE", {
    fName: "Ada",
    lName: "Lovelace",
    name: "Ada Lovelace",
  });

  assert.equal(result.status, "success");
  const stored = __getUsers()[0];
  assert.equal(stored.onboardingStep, "PLAN");
  assert.equal(stored.fName, "Ada");
  assert.equal(stored.name, "Ada Lovelace");
});

test("an unexpected failure during the conditional write leaves the profile and step unchanged", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "PROFILE", fName: "Old" });
  __simulateUnexpectedFailure();

  await assert.rejects(() =>
    onboardingFunnel.advanceParentOnboardingStep(user.id, "PROFILE", { fName: "New" })
  );

  const stored = __getUsers()[0];
  assert.equal(stored.fName, "Old", "no partial write may survive a failed operation");
  assert.equal(stored.onboardingStep, "PROFILE");
});

test("requireParentAtStep authorizes a parent on the exact required step with incomplete onboarding", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "CHILDREN" });

  const result = await onboardingFunnel.requireParentAtStep(user.id, "CHILDREN");

  assert.deepEqual(result, { authorized: true });
});

test("requireParentAtStep rejects a non-parent role", async () => {
  const user = __seedUser({ role: "CHILD", onboardingStep: "CHILDREN" });

  const result = await onboardingFunnel.requireParentAtStep(user.id, "CHILDREN");

  assert.equal("authorized" in result, false);
  assert.equal((result as { status: string }).status, "recovery");
});

test("requireParentAtStep rejects a step mismatch and a completed account", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "PLAN" });
  const mismatch = await onboardingFunnel.requireParentAtStep(user.id, "CHILDREN");
  assert.equal("authorized" in mismatch, false);

  const completed = __seedUser({
    role: "PARENT",
    onboardingStep: "COMPLETE",
    onboardingCompleted: true,
  });
  const completedResult = await onboardingFunnel.requireParentAtStep(
    completed.id,
    "CHILDREN"
  );
  assert.equal("authorized" in completedResult, false);
});

test("requireParentAtStep reports unauthenticated for a missing user", async () => {
  const result = await onboardingFunnel.requireParentAtStep("missing-user", "CHILDREN");

  assert.deepEqual(result, { status: "unauthenticated" });
});
