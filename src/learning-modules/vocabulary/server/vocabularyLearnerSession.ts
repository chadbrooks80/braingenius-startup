import "server-only";

import { randomUUID } from "node:crypto";

export const VOCABULARY_LEARNER_COOKIE = "brain-genius-learner";

export function getVocabularyLearnerId(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.trim().split("=");
    if (rawName === VOCABULARY_LEARNER_COOKIE) {
      try {
        const value = decodeURIComponent(rawValue.join("="));
        return isOpaqueIdentifier(value) ? value : null;
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function getOrCreateVocabularyLearner(request: Request): {
  learnerId: string;
  setCookie: string | null;
} {
  const existing = getVocabularyLearnerId(request);
  if (existing) {
    return { learnerId: existing, setCookie: null };
  }

  const learnerId = randomUUID();
  const secureAttribute = new URL(request.url).protocol === "https:"
    ? "; Secure"
    : "";
  return {
    learnerId,
    setCookie: `${VOCABULARY_LEARNER_COOKIE}=${encodeURIComponent(learnerId)}; Path=/; HttpOnly; SameSite=Strict${secureAttribute}`,
  };
}

function isOpaqueIdentifier(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
