import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic import below so `@/lib/db` and `next-auth`
// resolve to the fakes for every transitive import auth.ts performs.
registerAuthTestHooks();

import { __resetFakeDb, __seedUser } from "./testDoubles/fakeDb";

let jwtCallback: (params: {
  token: Record<string, unknown>;
  user?: { id: string };
  trigger?: "signIn" | "signUp" | "update";
  session?: Record<string, unknown>;
}) => Promise<Record<string, unknown>>;

before(async () => {
  const { authOptions } = await import("../../src/auth");
  jwtCallback = authOptions.callbacks!.jwt! as typeof jwtCallback;
});

beforeEach(() => {
  __resetFakeDb();
});

test("a fresh sign-in populates the token from the database, not the provider payload", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "PROFILE", onboardingCompleted: false });

  const token = await jwtCallback({ token: {}, user: { id: user.id } });

  assert.equal(token.id, user.id);
  assert.equal(token.onboardingStep, "PROFILE");
  assert.equal(token.onboardingCompleted, false);
});

test("session.update() re-reads the database and ignores browser-supplied onboarding claims", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "PROFILE", onboardingCompleted: false });

  const staleToken = { id: user.id, onboardingStep: "WELCOME_VIDEO", onboardingCompleted: false };

  const refreshed = await jwtCallback({
    token: staleToken,
    trigger: "update",
    // A caller attempting to claim it already finished onboarding.
    session: { onboardingStep: "COMPLETE", onboardingCompleted: true },
  });

  assert.equal(refreshed.onboardingStep, "PROFILE", "must reflect the database, not the claim");
  assert.equal(refreshed.onboardingCompleted, false);
});

test("session.update() reflects a real completed transition from the database", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "COMPLETE", onboardingCompleted: true });
  const staleToken = { id: user.id, onboardingStep: "CHILDREN", onboardingCompleted: false };

  const refreshed = await jwtCallback({ token: staleToken, trigger: "update" });

  assert.equal(refreshed.onboardingStep, "COMPLETE");
  assert.equal(refreshed.onboardingCompleted, true);
});

test("an update trigger with no usable token id leaves the token unchanged", async () => {
  const token = { onboardingStep: "PROFILE", onboardingCompleted: false };

  const result = await jwtCallback({
    token,
    trigger: "update",
    session: { onboardingStep: "COMPLETE", onboardingCompleted: true },
  });

  assert.equal(result.onboardingStep, "PROFILE");
  assert.equal(result.onboardingCompleted, false);
});

test("an update trigger for an account that no longer exists leaves the token unchanged", async () => {
  const staleToken = { id: "deleted-user", onboardingStep: "PROFILE", onboardingCompleted: false };

  const result = await jwtCallback({
    token: staleToken,
    trigger: "update",
    session: { onboardingStep: "COMPLETE", onboardingCompleted: true },
  });

  assert.equal(result.onboardingStep, "PROFILE");
  assert.equal(result.onboardingCompleted, false);
});
