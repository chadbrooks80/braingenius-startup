import assert from "node:assert/strict";
import { test } from "node:test";
import { CanonicalEmailSchema, normalizeEmail } from "../../src/lib/auth/email-normalization";

test("normalizeEmail trims and lowercases valid variants to the same canonical address", () => {
  assert.equal(normalizeEmail("Parent@Example.com"), "parent@example.com");
  assert.equal(normalizeEmail("parent@example.com"), "parent@example.com");
  assert.equal(normalizeEmail("PARENT@EXAMPLE.COM"), "parent@example.com");
  assert.equal(normalizeEmail("  parent@example.com  "), "parent@example.com");
  assert.equal(normalizeEmail("\tParent@Example.com\n"), "parent@example.com");
});

test("normalizeEmail returns null for invalid input instead of throwing", () => {
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeEmail(""), null);
  assert.equal(normalizeEmail("   "), null);
  assert.equal(normalizeEmail("missing-at-sign.com"), null);
  assert.equal(normalizeEmail("double@@at.com"), null);
});

test("CanonicalEmailSchema canonicalizes as a Zod field the same way as normalizeEmail", () => {
  const result = CanonicalEmailSchema.safeParse(" Parent@Example.com ");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data, "parent@example.com");
  }
});

test("CanonicalEmailSchema rejects invalid input as a safe parse failure, not a throw", () => {
  const result = CanonicalEmailSchema.safeParse("not-an-email");
  assert.equal(result.success, false);
});

test("CanonicalEmailSchema rejects non-string input", () => {
  const result = CanonicalEmailSchema.safeParse(12345);
  assert.equal(result.success, false);
});
