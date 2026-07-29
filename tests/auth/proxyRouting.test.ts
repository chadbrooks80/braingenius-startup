import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { before, beforeEach, test } from "node:test";

// The proxy imports `getToken` from "next-auth/jwt"; redirect it to a
// controllable fake before the dynamic import below so the real proxy module
// (not a re-implementation of it) is exercised against a deterministic token.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next-auth/jwt") {
      return { url: new URL("./testDoubles/fakeNextAuthJwt.ts", import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

import { __setToken } from "./testDoubles/fakeNextAuthJwt";

let proxy: typeof import("../../src/proxy").proxy;

before(async () => {
  ({ proxy } = await import("../../src/proxy"));
});

beforeEach(() => {
  __setToken(null);
});

function request(pathname: string, search = ""): Request {
  return new Request(`https://example.test${pathname}${search}`);
}

test("an unauthenticated request to /dashboard redirects to sign-in with a callbackUrl", async () => {
  __setToken(null);
  const { NextRequest } = await import("next/server");
  const req = new NextRequest(request("/dashboard/vocabulary", "?x=1"));

  const res = await proxy(req);

  assert.equal(res.status, 307);
  const location = new URL(res.headers.get("location")!);
  assert.equal(location.pathname, "/sign-in");
  assert.equal(location.searchParams.get("callbackUrl"), "/dashboard/vocabulary?x=1");
});

test("an unauthenticated request to a non-dashboard route passes through", async () => {
  __setToken(null);
  const { NextRequest } = await import("next/server");
  const req = new NextRequest(request("/getting-started"));

  const res = await proxy(req);

  assert.equal(res.headers.get("location"), null);
});

test("an authenticated request to /dashboard always passes through regardless of stale reset/onboarding claims", async () => {
  const { NextRequest } = await import("next/server");

  // A stale token claiming reset is required must not be treated as a deny
  // decision here -- the (app) layout re-reads the database and is the only
  // authority for that.
  __setToken({ mustResetPassword: true, role: "CHILD", onboardingCompleted: true });
  let req = new NextRequest(request("/dashboard"));
  let res = await proxy(req);
  assert.equal(res.headers.get("location"), null);

  // A stale token claiming reset is already cleared must not grant access
  // either -- same reasoning, opposite direction.
  __setToken({ mustResetPassword: false, role: "PARENT", onboardingCompleted: false });
  req = new NextRequest(request("/dashboard"));
  res = await proxy(req);
  assert.equal(res.headers.get("location"), null);
});

test("an authenticated request to /required-password-reset passes through without a proxy-level redirect", async () => {
  const { NextRequest } = await import("next/server");
  __setToken({ mustResetPassword: false, role: "PARENT", onboardingCompleted: true });
  const req = new NextRequest(request("/required-password-reset"));

  const res = await proxy(req);

  assert.equal(res.headers.get("location"), null);
});
