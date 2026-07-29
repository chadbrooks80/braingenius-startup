import "server-only";
import { z } from "zod";

/**
 * The one server-owned canonicalization rule for email identity: trim
 * surrounding whitespace, lowercase the address, then validate the result.
 * Every identity lookup, storage write, and delivery target must go through
 * this schema (or `normalizeEmail` below) instead of an independent
 * `.trim().toLowerCase()` copy, so two callers can never disagree about what
 * "the same email" means.
 */
export const CanonicalEmailSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.email("Invalid email address")
);

/**
 * Canonicalizes a raw email string, returning `null` when the trimmed,
 * lowercased result is not a valid email rather than throwing. Callers that
 * need a Zod field (forms, request bodies) should use `CanonicalEmailSchema`
 * directly instead of this wrapper.
 */
export function normalizeEmail(rawEmail: string): string | null {
  const result = CanonicalEmailSchema.safeParse(rawEmail);
  return result.success ? result.data : null;
}
