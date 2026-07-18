import type { ActionPayload } from "@/types/learning";
import type { VocabularyAnswerSubmission } from "../types";

const DEFINITION_WINDOW_FIELDS = ["attemptId", "selectedChoiceId"] as const;
const SPELLING_WINDOW_FIELDS = ["attemptId", "answer"] as const;
const DEFINITION_SUBMISSION_FIELDS = [
  "answerType",
  ...DEFINITION_WINDOW_FIELDS,
] as const;
const SPELLING_SUBMISSION_FIELDS = [
  "answerType",
  ...SPELLING_WINDOW_FIELDS,
] as const;

/**
 * The single strict parser for the discriminated Vocabulary answer
 * submission. The browser-side action parser and the server endpoint both
 * delegate here so the per-variant field rules cannot drift. The server must
 * always call it independently; browser validation is never a security
 * boundary. Pure: no server-only imports.
 */
export function parseVocabularyAnswerSubmission(
  raw: unknown
): VocabularyAnswerSubmission | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const body = raw as Record<string, unknown>;

  if (
    body.answerType === "definition" &&
    hasExactFields(body, DEFINITION_SUBMISSION_FIELDS) &&
    isNonBlankString(body.attemptId) &&
    typeof body.selectedChoiceId === "string" &&
    body.selectedChoiceId !== ""
  ) {
    return {
      answerType: "definition",
      attemptId: body.attemptId,
      selectedChoiceId: body.selectedChoiceId,
    };
  }

  if (
    body.answerType === "spelling" &&
    hasExactFields(body, SPELLING_SUBMISSION_FIELDS) &&
    isNonBlankString(body.attemptId) &&
    isNonBlankString(body.answer)
  ) {
    return {
      answerType: "spelling",
      attemptId: body.attemptId,
      answer: body.answer,
    };
  }

  return null;
}

/**
 * Parses a window interaction payload into a submission. Window payloads
 * intentionally omit `answerType`; the exact interaction shape selects the
 * variant, then the shared submission parser enforces the full contract.
 */
export function parseVocabularySubmitAnswerPayload(
  payload: ActionPayload
): VocabularyAnswerSubmission {
  const submission = parseVocabularyAnswerSubmission(
    toSubmissionCandidate(payload)
  );

  if (!submission) {
    throw new Error(
      "Vocabulary submitAnswer contains missing, unknown, or mismatched fields."
    );
  }

  return submission;
}

function toSubmissionCandidate(payload: ActionPayload): unknown {
  if (hasExactFields(payload, DEFINITION_WINDOW_FIELDS)) {
    return { answerType: "definition", ...payload };
  }

  if (hasExactFields(payload, SPELLING_WINDOW_FIELDS)) {
    return { answerType: "spelling", ...payload };
  }

  return null;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function hasExactFields(
  value: Record<string, unknown>,
  allowedFields: readonly string[]
): boolean {
  const fields = Object.keys(value);
  return (
    fields.length === allowedFields.length &&
    fields.every((field) => allowedFields.includes(field))
  );
}
