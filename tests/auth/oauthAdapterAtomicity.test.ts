import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

registerAuthTestHooks();

import { OnboardingStep } from "@/generated/prisma";
import {
  __failNextDbOperation,
  __getAccounts,
  __getSubscriptions,
  __getUsers,
  __resetFakeDb,
  __seedUser,
} from "./testDoubles/fakeDb";

let adapter: Adapter;
let advanceParentOnboardingStep: typeof import("@/lib/onboarding-funnel").advanceParentOnboardingStep;

before(async () => {
  const { authOptions } = await import("../../src/auth");
  assert.ok(authOptions.adapter, "NextAuth must expose the configured adapter");
  adapter = authOptions.adapter;

  // Dynamically imported so this resolves after registerAuthTestHooks()
  // redirects "@/lib/db" to fakeDb -- a static top-of-file import would
  // resolve during module construction, before the hook is registered, and
  // silently reach the real Prisma client instead.
  ({ advanceParentOnboardingStep } = await import("@/lib/onboarding-funnel"));
});

beforeEach(() => {
  __resetFakeDb();
});

function createUser(): Promise<AdapterUser> {
  assert.ok(adapter.createUser, "adapter.createUser must be configured");
  return adapter.createUser({
    name: "OAuth Parent",
    email: "oauth-parent@example.com",
    emailVerified: new Date("2026-07-29T12:00:00.000Z"),
    image: "https://example.com/avatar.png",
  });
}

function googleAccount(userId: string, providerAccountId = "google-account-1"): AdapterAccount {
  return {
    userId,
    type: "oauth",
    provider: "google",
    providerAccountId,
    access_token: "test-access-token",
    token_type: "Bearer",
  };
}

async function linkAccount(account: AdapterAccount): Promise<void> {
  assert.ok(adapter.linkAccount, "adapter.linkAccount must be configured");
  await adapter.linkAccount(account);
}

test("OAuth provisioning creates one adapter-compatible user, one free trial, and WELCOME_VIDEO together", async () => {
  const created = await createUser();

  assert.equal(created.email, "oauth-parent@example.com");
  assert.equal(created.name, "OAuth Parent");
  assert.ok(created.emailVerified instanceof Date);
  assert.equal(typeof created.id, "string");

  assert.equal(__getUsers().length, 1);
  assert.equal(__getUsers()[0].onboardingStep, "WELCOME_VIDEO");
  assert.equal(__getSubscriptions().length, 1);
  assert.equal(__getSubscriptions()[0].userId, created.id);
  assert.equal(__getSubscriptions()[0].tier, "FREE_TRIAL");
});

test("a forced nested subscription failure leaves no OAuth user or subscription", async () => {
  __failNextDbOperation("oauth-subscription-create");

  await assert.rejects(createUser);

  assert.equal(__getUsers().length, 0);
  assert.equal(__getSubscriptions().length, 0);
});

test("a forced initial-onboarding write failure leaves no OAuth user or subscription", async () => {
  __failNextDbOperation("oauth-onboarding-write");

  await assert.rejects(createUser);

  assert.equal(__getUsers().length, 0);
  assert.equal(__getSubscriptions().length, 0);
});

test("OAuth provisioning writes an authoritative PARENT role that can advance past WELCOME_VIDEO", async () => {
  const created = await createUser();

  assert.equal(__getUsers()[0].role, "PARENT");

  // Proves the created account is eligible under the real parent onboarding
  // authorization predicate, not merely a fake-database default -- a
  // regression here means an omitted `role` write is masked again.
  const advanced = await advanceParentOnboardingStep(
    created.id,
    OnboardingStep.WELCOME_VIDEO
  );
  assert.equal(advanced.status, "success");
  assert.equal(__getUsers()[0].onboardingStep, OnboardingStep.PROFILE);
});

test("a duplicate OAuth create retry cannot add a second user or subscription", async () => {
  await createUser();

  await assert.rejects(createUser);

  assert.equal(__getUsers().length, 1);
  assert.equal(__getSubscriptions().length, 1);
});

test("Google linking persists one provider account and advances only an eligible unverified parent", async () => {
  const user = __seedUser({ email: "existing@example.com" });
  const account = googleAccount(user.id);

  await linkAccount(account);

  assert.equal(__getAccounts().length, 1);
  assert.equal(__getAccounts()[0].providerAccountId, account.providerAccountId);
  assert.ok(user.emailVerified instanceof Date);
  assert.equal(user.onboardingStep, "WELCOME_VIDEO");
});

test("a forced Google verification transition failure rolls back the provider account", async () => {
  const user = __seedUser({ email: "existing@example.com" });
  __failNextDbOperation("user-update-many");

  await assert.rejects(linkAccount(googleAccount(user.id)));

  assert.equal(__getAccounts().length, 0);
  assert.equal(user.emailVerified, null);
  assert.equal(user.onboardingStep, "VERIFY_EMAIL");
});

test("an already-verified or later-step account links without a funnel rewrite", async () => {
  const verifiedAt = new Date("2026-07-20T12:00:00.000Z");
  const user = __seedUser({
    email: "advanced@example.com",
    emailVerified: verifiedAt,
    onboardingStep: "PROFILE",
  });

  await linkAccount(googleAccount(user.id));

  assert.equal(__getAccounts().length, 1);
  assert.equal(user.emailVerified, verifiedAt);
  assert.equal(user.onboardingStep, "PROFILE");
});

test("a child can link without entering the parent onboarding funnel", async () => {
  const child = __seedUser({
    email: "child@example.com",
    role: "CHILD",
    onboardingStep: "VERIFY_EMAIL",
  });

  await linkAccount(googleAccount(child.id));

  assert.equal(__getAccounts().length, 1);
  assert.equal(child.emailVerified, null);
  assert.equal(child.onboardingStep, "VERIFY_EMAIL");
});

test("a duplicate provider link follows the adapter uniqueness contract without duplicating rows", async () => {
  const user = __seedUser({ email: "existing@example.com" });
  const account = googleAccount(user.id);

  await linkAccount(account);
  await assert.rejects(linkAccount(account));

  assert.equal(__getAccounts().length, 1);
});
