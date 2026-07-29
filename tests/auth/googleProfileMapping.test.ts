import assert from "node:assert/strict";
import { before, test } from "node:test";
import { registerAuthTestHooks } from "./testDoubles/registerAuthTestHooks";

// Must run before the dynamic import below so `@/lib/db` and `next-auth`
// resolve to the fakes for every transitive import auth.ts performs.
registerAuthTestHooks();

type GoogleProfileInput = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type MappedGoogleUser = {
  id: string;
  name?: string;
  email: string;
  image?: string;
  emailVerified: Date | null;
};

let googleProfile: (profile: GoogleProfileInput) => MappedGoogleUser;

before(async () => {
  const { authOptions } = await import("../../src/auth");
  const googleProvider = authOptions.providers[0] as unknown as {
    profile: (profile: GoogleProfileInput) => MappedGoogleUser;
  };
  googleProfile = googleProvider.profile;
});

function baseProfile(overrides: Partial<GoogleProfileInput> = {}): GoogleProfileInput {
  return {
    sub: "google-sub-1",
    email: "Parent@Example.com",
    email_verified: true,
    name: "Parent Name",
    picture: "https://example.com/pic.jpg",
    ...overrides,
  };
}

test("maps a valid Google email to its canonical trimmed, lowercased form", () => {
  const mapped = googleProfile(baseProfile({ email: "  Parent@Example.com " }));
  assert.equal(mapped.email, "parent@example.com");
  assert.equal(mapped.id, "google-sub-1");
  assert.ok(mapped.emailVerified instanceof Date);
});

test("an already-canonical Google email maps unchanged", () => {
  const mapped = googleProfile(baseProfile({ email: "parent@example.com" }));
  assert.equal(mapped.email, "parent@example.com");
});

test("email_verified: false maps to a null emailVerified regardless of Google's own claim", () => {
  const mapped = googleProfile(baseProfile({ email_verified: false }));
  assert.equal(mapped.emailVerified, null);
});

test("a missing/empty provider email is rejected instead of falling back to a raw value", () => {
  assert.throws(() => googleProfile(baseProfile({ email: "" })), /INVALID_GOOGLE_EMAIL/);
});

test("a malformed provider email is rejected instead of falling back to a raw value", () => {
  assert.throws(() => googleProfile(baseProfile({ email: "not-an-email" })), /INVALID_GOOGLE_EMAIL/);
});

test("whitespace-only provider email is rejected", () => {
  assert.throws(() => googleProfile(baseProfile({ email: "   " })), /INVALID_GOOGLE_EMAIL/);
});
