import "server-only";

import { createHash } from "node:crypto";

const CHOICE_ID_NAMESPACE = "vocabulary-choice-projection-v1";

export function getVocabularyPublicChoiceId(
  attemptId: string,
  internalChoiceId: string
): string {
  const digest = createHash("sha256")
    .update(`${CHOICE_ID_NAMESPACE}:${attemptId}:${internalChoiceId}`)
    .digest("hex");

  return `choice-${digest.slice(0, 24)}`;
}
