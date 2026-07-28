import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { buildPasswordResetUrl, resolveAppBaseUrl } from "@/lib/app-base-url";

const ENV_KEYS = ["NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL", "NODE_ENV"] as const;
let savedEnv: Record<string, string | undefined>;

// `NODE_ENV` is typed read-only in `@types/node` to discourage casual
// mutation, but it is a genuinely writable runtime env var and this test
// suite is the approved place to vary it. `Reflect.set` flips it without an
// `as`/non-null cast that would hide an unrelated type problem.
function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    Reflect.set(process.env, key, value);
  }
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    setEnv(key, undefined);
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    setEnv(key, savedEnv[key]);
  }
});

test("a valid HTTPS NEXTAUTH_URL is used as the trusted origin", () => {
  setEnv("NEXTAUTH_URL", "https://app.example.com");
  setEnv("NEXT_PUBLIC_APP_URL", "https://should-not-be-used.example.com");

  assert.equal(resolveAppBaseUrl(), "https://app.example.com");
});

test("falls back to a valid NEXT_PUBLIC_APP_URL when NEXTAUTH_URL is absent", () => {
  setEnv("NEXT_PUBLIC_APP_URL", "https://public.example.com");

  assert.equal(resolveAppBaseUrl(), "https://public.example.com");
});

test("falls back to localhost outside production when nothing is configured", () => {
  setEnv("NODE_ENV", "test");

  assert.equal(resolveAppBaseUrl(), "http://localhost:3000");
});

test("returns null in production when both NEXTAUTH_URL and NEXT_PUBLIC_APP_URL are missing", () => {
  setEnv("NODE_ENV", "production");

  assert.equal(resolveAppBaseUrl(), null);
});

test("rejects a malformed URL and falls through to the next candidate", () => {
  setEnv("NEXTAUTH_URL", "not a url");
  setEnv("NEXT_PUBLIC_APP_URL", "https://public.example.com");

  assert.equal(resolveAppBaseUrl(), "https://public.example.com");
});

test("rejects a non-HTTP protocol and falls through to the next candidate", () => {
  setEnv("NEXTAUTH_URL", "ftp://app.example.com");
  setEnv("NEXT_PUBLIC_APP_URL", "https://public.example.com");

  assert.equal(resolveAppBaseUrl(), "https://public.example.com");
});

test("rejects a candidate carrying embedded credentials", () => {
  setEnv("NEXTAUTH_URL", "https://user:pass@app.example.com");
  setEnv("NEXT_PUBLIC_APP_URL", "https://public.example.com");

  assert.equal(resolveAppBaseUrl(), "https://public.example.com");
});

test("normalizes away a configured path, query, and fragment", () => {
  setEnv("NEXTAUTH_URL", "https://app.example.com/some/path?x=1#frag");

  assert.equal(resolveAppBaseUrl(), "https://app.example.com");
});

test("production with a malformed NEXTAUTH_URL and no NEXT_PUBLIC_APP_URL returns null", () => {
  setEnv("NODE_ENV", "production");
  setEnv("NEXTAUTH_URL", "not a url");

  assert.equal(resolveAppBaseUrl(), null);
});

test("buildPasswordResetUrl escapes token and email through URLSearchParams", () => {
  setEnv("NEXTAUTH_URL", "https://app.example.com");

  const url = buildPasswordResetUrl("tok en&value", "user+test@example.com");

  assert.ok(url);
  assert.equal(url.origin, "https://app.example.com");
  assert.equal(url.pathname, "/reset-password");
  assert.equal(url.searchParams.get("token"), "tok en&value");
  assert.equal(url.searchParams.get("email"), "user+test@example.com");
  assert.ok(url.toString().includes("token=tok+en%26value"));
});

test("buildPasswordResetUrl returns null when no trusted origin is configured", () => {
  setEnv("NODE_ENV", "production");

  assert.equal(buildPasswordResetUrl("token", "user@example.com"), null);
});
