import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic import below so `@/lib/db` and `next-auth`
// resolve to the fakes for every transitive import auth.ts performs.
registerAuthTestHooks();

import { __resetFakeDb, __seedUser, __seedSubscription, __seedParentStudent } from "./testDoubles/fakeDb";

let jwtCallback: (params: {
  token: Record<string, unknown>;
  user?: { id: string };
  trigger?: "signIn" | "signUp" | "update";
  session?: Record<string, unknown>;
}) => Promise<Record<string, unknown>>;

let sessionCallback: (params: {
  session: { user?: Record<string, unknown> };
  token: Record<string, unknown>;
}) => Promise<{ user?: Record<string, unknown> }>;

before(async () => {
  const { authOptions } = await import("../../src/auth");
  jwtCallback = authOptions.callbacks!.jwt! as typeof jwtCallback;
  sessionCallback = authOptions.callbacks!.session! as unknown as typeof sessionCallback;
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

test("a fresh sign-in populates subscriptionTier from the database, not a provider payload", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "COMPLETE", onboardingCompleted: true });
  __seedSubscription({ userId: user.id, tier: "ADMIN" });

  const token = await jwtCallback({ token: {}, user: { id: user.id } });

  assert.equal(token.subscriptionTier, "ADMIN");
});

test("a user with no current subscription resolves subscriptionTier to null on fresh sign-in", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "COMPLETE", onboardingCompleted: true });

  const token = await jwtCallback({ token: {}, user: { id: user.id } });

  assert.equal(token.subscriptionTier, null);
});

test("a CHILD with no direct subscription inherits the linked parent's tier on fresh sign-in", async () => {
  const parent = __seedUser({ role: "PARENT" });
  __seedSubscription({ userId: parent.id, tier: "ADMIN" });
  const child = __seedUser({ role: "CHILD" });
  __seedParentStudent(parent.id, child.id);

  const token = await jwtCallback({ token: {}, user: { id: child.id } });

  assert.equal(token.subscriptionTier, "ADMIN");
});

test("session.update() re-reads subscriptionTier from the database and ignores a browser-supplied claim", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "COMPLETE", onboardingCompleted: true });
  const staleToken = { id: user.id, onboardingStep: "COMPLETE", onboardingCompleted: true, subscriptionTier: null };

  const refreshed = await jwtCallback({
    token: staleToken,
    trigger: "update",
    // A caller attempting to forge an elevated tier through the update payload.
    session: { subscriptionTier: "ADMIN" },
  });

  assert.equal(refreshed.subscriptionTier, null, "must reflect the database, not the forged claim");
});

test("session.update() reflects a real subscription upgrade recorded in the database", async () => {
  const user = __seedUser({ role: "PARENT", onboardingStep: "COMPLETE", onboardingCompleted: true });
  __seedSubscription({ userId: user.id, tier: "ADMIN" });
  const staleToken = { id: user.id, onboardingStep: "COMPLETE", onboardingCompleted: true, subscriptionTier: null };

  const refreshed = await jwtCallback({ token: staleToken, trigger: "update" });

  assert.equal(refreshed.subscriptionTier, "ADMIN");
});

test("the session callback projects subscriptionTier and never lets a forged session field through", async () => {
  const token = { id: "user-1", role: "PARENT", onboardingCompleted: true, onboardingStep: "COMPLETE", mustResetPassword: false, subscriptionTier: "ADMIN" };

  const session = await sessionCallback({
    session: { user: { subscriptionTier: "LIFETIME" } },
    token,
  });

  assert.equal(session.user?.subscriptionTier, "ADMIN", "must come from the token, not a pre-existing session field");
});

test("the session callback projects a null subscriptionTier as null, not undefined", async () => {
  const token = { id: "user-1", role: "PARENT", onboardingCompleted: true, onboardingStep: "COMPLETE", mustResetPassword: false };

  const session = await sessionCallback({ session: { user: {} }, token });

  assert.equal(session.user?.subscriptionTier, null);
});
