import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeReturnPath } from "../../src/lib/auth-return-path";

test("missing and blank values fall back to /dashboard", () => {
  assert.equal(sanitizeReturnPath(null), "/dashboard");
  assert.equal(sanitizeReturnPath(undefined), "/dashboard");
  assert.equal(sanitizeReturnPath(""), "/dashboard");
  assert.equal(sanitizeReturnPath("   "), "/dashboard");
});

test("accepts /dashboard unchanged", () => {
  assert.equal(sanitizeReturnPath("/dashboard"), "/dashboard");
});

test("accepts a nested learning route", () => {
  assert.equal(
    sanitizeReturnPath("/learning/vocabulary/word_list_id"),
    "/learning/vocabulary/word_list_id"
  );
});

test("accepts a safe query string and fragment", () => {
  assert.equal(
    sanitizeReturnPath("/learning/vocabulary/word_list_id?step=2#recap"),
    "/learning/vocabulary/word_list_id?step=2#recap"
  );
});

test("rejects an absolute external URL", () => {
  assert.equal(sanitizeReturnPath("https://evil.example/path"), "/dashboard");
});

test("rejects an absolute URL using the validation origin", () => {
  assert.equal(
    sanitizeReturnPath("https://auth-return-path.internal.invalid/dashboard"),
    "/dashboard"
  );
});

test("rejects a protocol-relative URL", () => {
  assert.equal(sanitizeReturnPath("//evil.example"), "/dashboard");
});

test("rejects javascript: URLs", () => {
  assert.equal(sanitizeReturnPath("javascript:alert(1)"), "/dashboard");
});

test("rejects data: URLs", () => {
  assert.equal(sanitizeReturnPath("data:text/html,<script>alert(1)</script>"), "/dashboard");
});

test("rejects raw backslash confusion", () => {
  assert.equal(sanitizeReturnPath("/\\evil.example"), "/dashboard");
  assert.equal(sanitizeReturnPath("\\\\evil.example"), "/dashboard");
});

test("rejects encoded slash confusion", () => {
  assert.equal(sanitizeReturnPath("/%2F%2Fevil.example"), "/dashboard");
});

test("rejects encoded backslash confusion", () => {
  assert.equal(sanitizeReturnPath("/%5Cevil.example"), "/dashboard");
});

test("rejects encoded dot-segment confusion", () => {
  assert.equal(sanitizeReturnPath("/%2e%2e/dashboard"), "/dashboard");
  assert.equal(sanitizeReturnPath("/settings/%2e%2e%2f%2e%2e/dashboard"), "/dashboard");
});

test("rejects malformed percent encoding", () => {
  assert.equal(sanitizeReturnPath("/%zz"), "/dashboard");
  assert.equal(sanitizeReturnPath("/dashboard%"), "/dashboard");
});

test("rejects control characters", () => {
  assert.equal(sanitizeReturnPath("/dashboard\n"), "/dashboard");
  assert.equal(sanitizeReturnPath("/dashboard\t"), "/dashboard");
});

test("rejects /sign-in and nested sign-in callback loops", () => {
  assert.equal(sanitizeReturnPath("/sign-in"), "/dashboard");
  assert.equal(sanitizeReturnPath("/sign-in?callbackUrl=%2Fdashboard"), "/dashboard");
  assert.equal(sanitizeReturnPath("/sign-in/nested"), "/dashboard");
});

test("every rejected value falls back to exactly /dashboard", () => {
  const rejected = [
    "https://evil.example",
    "//evil.example",
    "javascript:alert(1)",
    "/\\evil.example",
    "/%2F%2Fevil.example",
    "/%2e%2e/admin",
    "/../etc",
    "/%zz",
    "/sign-in",
  ];

  for (const value of rejected) {
    assert.equal(sanitizeReturnPath(value), "/dashboard");
  }
});
