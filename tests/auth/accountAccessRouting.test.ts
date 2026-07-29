import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAccountAccessRoute,
  REQUIRED_PASSWORD_RESET_ROUTE,
} from "../../src/lib/auth/account-access";

test("a reset-required account always resolves to the required-reset route regardless of role or onboarding state", () => {
  assert.equal(
    getAccountAccessRoute({
      role: "CHILD",
      mustResetPassword: true,
      onboardingCompleted: false,
      onboardingStep: "VERIFY_EMAIL",
    }),
    REQUIRED_PASSWORD_RESET_ROUTE
  );

  assert.equal(
    getAccountAccessRoute({
      role: "PARENT",
      mustResetPassword: true,
      onboardingCompleted: true,
      onboardingStep: "COMPLETE",
    }),
    REQUIRED_PASSWORD_RESET_ROUTE
  );
});

test("a CHILD with the flag clear routes to /dashboard, never the parent verify-email/onboarding funnel", () => {
  assert.equal(
    getAccountAccessRoute({
      role: "CHILD",
      mustResetPassword: false,
      onboardingCompleted: false,
      onboardingStep: "VERIFY_EMAIL",
    }),
    "/dashboard"
  );
});

test("a PARENT with the flag clear routes through the normal onboarding funnel, unchanged", () => {
  assert.equal(
    getAccountAccessRoute({
      role: "PARENT",
      mustResetPassword: false,
      onboardingCompleted: false,
      onboardingStep: "VERIFY_EMAIL",
    }),
    "/verify-email"
  );

  assert.equal(
    getAccountAccessRoute({
      role: "PARENT",
      mustResetPassword: false,
      onboardingCompleted: false,
      onboardingStep: "PROFILE",
    }),
    "/getting-started"
  );

  assert.equal(
    getAccountAccessRoute({
      role: "PARENT",
      mustResetPassword: false,
      onboardingCompleted: true,
      onboardingStep: "COMPLETE",
    }),
    "/dashboard"
  );
});

test("a null role with the flag clear falls back to the ordinary onboarding funnel", () => {
  assert.equal(
    getAccountAccessRoute({
      role: null,
      mustResetPassword: false,
      onboardingCompleted: true,
      onboardingStep: "COMPLETE",
    }),
    "/dashboard"
  );
});
