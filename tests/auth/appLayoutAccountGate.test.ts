import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic import below so `@/lib/db` and `next-auth`
// resolve to the fakes for every transitive import the layout performs.
registerAuthTestHooks();

import { __resetFakeDb, __seedUser } from "./testDoubles/fakeDb";
import { __setSessionUserId } from "./testDoubles/fakeNextAuth";

type AppLayoutProps = { children: React.ReactNode };

let AppLayout: (props: AppLayoutProps) => Promise<unknown>;

before(async () => {
  ({ default: AppLayout } = await import("../../src/app/(app)/layout"));
});

beforeEach(() => {
  __resetFakeDb();
  __setSessionUserId(undefined);
});

function isRedirectError(error: unknown): error is { digest: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT;")
  );
}

function redirectDestination(error: { digest: string }): string {
  return error.digest.split(";").slice(2, -2).join(";");
}

const CHILDREN_MARKER = "protected-children-rendered";

async function runLayout(): Promise<{ redirected: true; destination: string } | { redirected: false }> {
  try {
    await AppLayout({ children: CHILDREN_MARKER });
    return { redirected: false };
  } catch (error) {
    if (isRedirectError(error)) {
      return { redirected: true, destination: redirectDestination(error) };
    }
    throw error;
  }
}

test("an anonymous request renders children without a database read", async () => {
  const result = await runLayout();
  assert.deepEqual(result, { redirected: false });
});

test("a session whose user row no longer exists fails closed to sign-in instead of rendering", async () => {
  __setSessionUserId("missing-user-id");

  const result = await runLayout();

  assert.deepEqual(result, { redirected: true, destination: "/sign-in" });
});

test("a reset-required account is redirected to /required-password-reset", async () => {
  const user = __seedUser({ role: "CHILD", mustResetPassword: true });
  __setSessionUserId(user.id);

  const result = await runLayout();

  assert.deepEqual(result, { redirected: true, destination: "/required-password-reset" });
});

test("a cleared account renders children normally", async () => {
  const user = __seedUser({
    role: "PARENT",
    mustResetPassword: false,
    onboardingCompleted: true,
    onboardingStep: "COMPLETE",
  });
  __setSessionUserId(user.id);

  const result = await runLayout();

  assert.deepEqual(result, { redirected: false });
});
