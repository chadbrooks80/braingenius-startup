import type { VocabularyContentRequest } from "../data/vocabularyContentTypes";

const MANIFEST_FIELDS = ["contentType", "wordListId"] as const;
const SCREEN_CONTENT_FIELDS = [
  "contentType",
  "lessonId",
  "capability",
] as const;
const RECAP_FIELDS = [
  "contentType",
  "lessonId",
  "capability",
  "exampleIndex",
] as const;

export function parseVocabularyContentRequest(
  raw: unknown
): VocabularyContentRequest | null {
  if (!isRecord(raw)) {
    return null;
  }

  if (
    raw.contentType === "manifest" &&
    hasExactFields(raw, MANIFEST_FIELDS) &&
    isNonBlankString(raw.wordListId)
  ) {
    return { contentType: "manifest", wordListId: raw.wordListId };
  }

  if (
    !isOpaqueIdentifier(raw.lessonId) ||
    !isOpaqueIdentifier(raw.capability)
  ) {
    return null;
  }

  if (
    (raw.contentType === "definition-display" ||
      raw.contentType === "definition-fun-fact" ||
      raw.contentType === "definition-practice" ||
      raw.contentType === "spelling-practice") &&
    hasExactFields(raw, SCREEN_CONTENT_FIELDS)
  ) {
    return {
      contentType: raw.contentType,
      lessonId: raw.lessonId,
      capability: raw.capability,
    };
  }

  if (
    raw.contentType === "answer-recap" &&
    hasExactFields(raw, RECAP_FIELDS) &&
    Number.isInteger(raw.exampleIndex) &&
    typeof raw.exampleIndex === "number" &&
    raw.exampleIndex >= 0 &&
    raw.exampleIndex < 3
  ) {
    return {
      contentType: "answer-recap",
      lessonId: raw.lessonId,
      capability: raw.capability,
      exampleIndex: raw.exampleIndex,
    };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isOpaqueIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function hasExactFields(
  value: Record<string, unknown>,
  fields: readonly string[]
): boolean {
  const actualFields = Object.keys(value);
  return (
    actualFields.length === fields.length &&
    actualFields.every((field) => fields.includes(field))
  );
}
