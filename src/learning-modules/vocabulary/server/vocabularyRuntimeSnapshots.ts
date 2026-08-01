import "server-only";

import type {
  VocabularyChoice,
  VocabularyContentResponse,
} from "../data/vocabularyContentTypes";
import type { VocabularyListWordRow } from "./vocabularyListStore";
import type {
  VocabularyLessonStateSnapshot,
  VocabularyLessonStep,
  VocabularyWordProgress,
} from "../state/VocabularyLessonState";
import type { VocabularyActiveAttempt } from "../state/VocabularyActiveAttempt";
import type { VocabularyAnswerSubmission } from "../types";

// Explicit, versioned, strictly parsed server-only payload contracts for the
// three `ModVocabRuntimeRecord` kinds that replace
// `VocabularyContentCapabilityStore`'s former in-memory lesson/capability/
// attempt-index Maps. Every database read must go through the matching
// parser below rather than a TypeScript cast: a malformed or unknown
// `schemaVersion` (a downgrade, a manual edit, a future incompatible
// change) must fail safely through the store's existing generic
// server-unavailable path instead of being trusted.
export const RUNTIME_SNAPSHOT_SCHEMA_VERSION = 1 as const;

// The capability store only ever screen-authorizes a bound step, never
// "lesson-complete" (which ends the chain instead of issuing a capability).
export type VocabularyScreenStep = Exclude<
  VocabularyLessonStep,
  { kind: "lesson-complete" }
>;

// `getVocabularyContent` never returns "manifest" or "word-refill": both are
// handled directly in `handleVocabularyContentRequest` before any
// capability-scoped content is built, so a capability's cached
// `contentResponse` can never legitimately hold either variant.
export type VocabularyCapabilityContentResponse = Exclude<
  VocabularyContentResponse,
  { contentType: "manifest" } | { contentType: "word-refill" }
>;

export type VocabularyRuntimeRefillOutcome = { wordId: string | null };

export type LessonRuntimeSnapshot = {
  schemaVersion: 1;
  userId: string;
  learningId: string;
  listId: string;
  sessionId: string;
  randomSeed: number;
  lessonState: VocabularyLessonStateSnapshot;
  canonicalWordIdByLessonWordId: Record<string, string>;
  wordRecordCache: Record<string, VocabularyListWordRow>;
  lastLoadedPosition: number;
  refillsFulfilled: number;
  lastRefillResult: VocabularyRuntimeRefillOutcome | null;
};

export type CapabilityRuntimeSnapshot = {
  schemaVersion: 1;
  userId: string;
  lessonId: string;
  listId: string;
  step: VocabularyScreenStep | null;
  predecessor: string | null;
  nextCapability: string | null;
  contentResponse: VocabularyCapabilityContentResponse | null;
};

export type AttemptIndexRuntimeSnapshot = {
  schemaVersion: 1;
  lessonId: string;
  successorCapability: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || isInteger(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
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

const WORD_PROGRESS_FIELDS = [
  "introduced",
  "definitionConsecutiveCorrect",
  "definitionMastered",
  "spellingConsecutiveCorrect",
  "spellingMastered",
  "practicePresentationCount",
  "reviewStage",
  "nextReviewQuestionNumber",
] as const;

function isVocabularyWordProgress(value: unknown): value is VocabularyWordProgress {
  return (
    isRecord(value) &&
    hasExactFields(value, WORD_PROGRESS_FIELDS) &&
    isBoolean(value.introduced) &&
    isInteger(value.definitionConsecutiveCorrect) &&
    isBoolean(value.definitionMastered) &&
    isInteger(value.spellingConsecutiveCorrect) &&
    isBoolean(value.spellingMastered) &&
    isInteger(value.practicePresentationCount) &&
    (value.reviewStage === "idle" ||
      value.reviewStage === "definition-pending" ||
      value.reviewStage === "spelling-pending") &&
    isNullableInteger(value.nextReviewQuestionNumber)
  );
}

function isVocabularyWordProgressRecord(
  value: unknown
): value is Record<string, VocabularyWordProgress> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => isVocabularyWordProgress(entry))
  );
}

const SUBMISSION_DEFINITION_FIELDS = ["answerType", "attemptId", "selectedChoiceId"] as const;
const SUBMISSION_SPELLING_FIELDS = ["answerType", "attemptId", "answer"] as const;

function isVocabularyAnswerSubmission(
  value: unknown
): value is VocabularyAnswerSubmission {
  if (!isRecord(value)) {
    return false;
  }
  if (value.answerType === "definition") {
    return (
      hasExactFields(value, SUBMISSION_DEFINITION_FIELDS) &&
      isString(value.attemptId) &&
      isString(value.selectedChoiceId)
    );
  }
  if (value.answerType === "spelling") {
    return (
      hasExactFields(value, SUBMISSION_SPELLING_FIELDS) &&
      isString(value.attemptId) &&
      isString(value.answer)
    );
  }
  return false;
}

const ACTIVE_ATTEMPT_FIELDS = [
  "wordId",
  "answerType",
  "attemptId",
  "validChoiceIds",
  "review",
  "answered",
  "answerPending",
  "submission",
] as const;

function isVocabularyActiveAttempt(
  value: unknown
): value is VocabularyActiveAttempt {
  return (
    isRecord(value) &&
    hasExactFields(value, ACTIVE_ATTEMPT_FIELDS) &&
    isString(value.wordId) &&
    (value.answerType === "definition" || value.answerType === "spelling") &&
    isString(value.attemptId) &&
    isStringArray(value.validChoiceIds) &&
    isBoolean(value.review) &&
    isBoolean(value.answered) &&
    isBoolean(value.answerPending) &&
    (value.submission === null || isVocabularyAnswerSubmission(value.submission))
  );
}

const INTRODUCTION_PHASE_FIELDS = ["wordId", "stage"] as const;

function isIntroductionPhase(
  value: unknown
): value is { wordId: string; stage: "definition-display" | "definition-fun-fact" } {
  return (
    isRecord(value) &&
    hasExactFields(value, INTRODUCTION_PHASE_FIELDS) &&
    isString(value.wordId) &&
    (value.stage === "definition-display" || value.stage === "definition-fun-fact")
  );
}

const PENDING_RECAP_FIELDS = ["kind", "wordId", "exampleIndex"] as const;

function isPendingRecap(
  value: unknown
): value is Extract<VocabularyLessonStep, { kind: "answer-recap" }> {
  return (
    isRecord(value) &&
    value.kind === "answer-recap" &&
    hasExactFields(value, PENDING_RECAP_FIELDS) &&
    isString(value.wordId) &&
    isInteger(value.exampleIndex)
  );
}

const LESSON_WORD_FIELDS = ["id"] as const;

function isVocabularyLessonWordArray(
  value: unknown
): value is { id: string }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) && hasExactFields(entry, LESSON_WORD_FIELDS) && isString(entry.id)
    )
  );
}

const LESSON_STATE_SNAPSHOT_FIELDS = [
  "schemaVersion",
  "words",
  "totalWordCount",
  "progressByWordId",
  "activeAttempt",
  "introductionPhase",
  "pendingRecap",
  "recapVisible",
  "gradedAnswerCount",
  "correctCount",
  "incorrectCount",
  "lastPracticedWordId",
  "completionReviewWordIds",
  "checkpointEligibleOrder",
  "servedCheckpointGroupCount",
  "pendingCheckpointWordIds",
  "randomDrawCount",
] as const;

export function isVocabularyLessonStateSnapshot(
  value: unknown
): value is VocabularyLessonStateSnapshot {
  return (
    isRecord(value) &&
    hasExactFields(value, LESSON_STATE_SNAPSHOT_FIELDS) &&
    value.schemaVersion === RUNTIME_SNAPSHOT_SCHEMA_VERSION &&
    isVocabularyLessonWordArray(value.words) &&
    isInteger(value.totalWordCount) &&
    isVocabularyWordProgressRecord(value.progressByWordId) &&
    (value.activeAttempt === null || isVocabularyActiveAttempt(value.activeAttempt)) &&
    (value.introductionPhase === null || isIntroductionPhase(value.introductionPhase)) &&
    (value.pendingRecap === null || isPendingRecap(value.pendingRecap)) &&
    isBoolean(value.recapVisible) &&
    isInteger(value.gradedAnswerCount) &&
    isInteger(value.correctCount) &&
    isInteger(value.incorrectCount) &&
    (value.lastPracticedWordId === null || isString(value.lastPracticedWordId)) &&
    (value.completionReviewWordIds === null || isStringArray(value.completionReviewWordIds)) &&
    isStringArray(value.checkpointEligibleOrder) &&
    isInteger(value.servedCheckpointGroupCount) &&
    (value.pendingCheckpointWordIds === null || isStringArray(value.pendingCheckpointWordIds)) &&
    isInteger(value.randomDrawCount)
  );
}

const LIST_WORD_ROW_FIELDS = [
  "id",
  "position",
  "word",
  "definition",
  "spellingDefinition",
  "exampleSentence1",
  "exampleSentence2",
  "exampleSentence3",
  "interestingFact",
] as const;

function isVocabularyListWordRow(value: unknown): value is VocabularyListWordRow {
  return (
    isRecord(value) &&
    hasExactFields(value, LIST_WORD_ROW_FIELDS) &&
    isString(value.id) &&
    isInteger(value.position) &&
    isString(value.word) &&
    isNullableString(value.definition) &&
    isNullableString(value.spellingDefinition) &&
    isNullableString(value.exampleSentence1) &&
    isNullableString(value.exampleSentence2) &&
    isNullableString(value.exampleSentence3) &&
    isNullableString(value.interestingFact)
  );
}

function isVocabularyListWordRowRecord(
  value: unknown
): value is Record<string, VocabularyListWordRow> {
  return isRecord(value) && Object.values(value).every(isVocabularyListWordRow);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(isString);
}

const REFILL_OUTCOME_FIELDS = ["wordId"] as const;

function isRefillOutcome(value: unknown): value is VocabularyRuntimeRefillOutcome {
  return (
    isRecord(value) &&
    hasExactFields(value, REFILL_OUTCOME_FIELDS) &&
    (value.wordId === null || isString(value.wordId))
  );
}

const LESSON_SNAPSHOT_FIELDS = [
  "schemaVersion",
  "userId",
  "learningId",
  "listId",
  "sessionId",
  "randomSeed",
  "lessonState",
  "canonicalWordIdByLessonWordId",
  "wordRecordCache",
  "lastLoadedPosition",
  "refillsFulfilled",
  "lastRefillResult",
] as const;

export function parseLessonRuntimeSnapshot(value: unknown): LessonRuntimeSnapshot | null {
  if (
    !isRecord(value) ||
    !hasExactFields(value, LESSON_SNAPSHOT_FIELDS) ||
    value.schemaVersion !== RUNTIME_SNAPSHOT_SCHEMA_VERSION ||
    !isString(value.userId) ||
    !isString(value.learningId) ||
    !isString(value.listId) ||
    !isString(value.sessionId) ||
    !isInteger(value.randomSeed) ||
    !isVocabularyLessonStateSnapshot(value.lessonState) ||
    !isStringRecord(value.canonicalWordIdByLessonWordId) ||
    !isVocabularyListWordRowRecord(value.wordRecordCache) ||
    !isInteger(value.lastLoadedPosition) ||
    !isInteger(value.refillsFulfilled) ||
    (value.lastRefillResult !== null && !isRefillOutcome(value.lastRefillResult))
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    userId: value.userId,
    learningId: value.learningId,
    listId: value.listId,
    sessionId: value.sessionId,
    randomSeed: value.randomSeed,
    lessonState: value.lessonState,
    canonicalWordIdByLessonWordId: value.canonicalWordIdByLessonWordId,
    wordRecordCache: value.wordRecordCache,
    lastLoadedPosition: value.lastLoadedPosition,
    refillsFulfilled: value.refillsFulfilled,
    lastRefillResult: value.lastRefillResult,
  };
}

const CHOICE_FIELDS = ["id", "text"] as const;

function isVocabularyChoice(value: unknown): value is VocabularyChoice {
  return (
    isRecord(value) &&
    hasExactFields(value, CHOICE_FIELDS) &&
    isString(value.id) &&
    isString(value.text)
  );
}

function isExampleSentenceTriple(value: unknown): value is [string, string, string] {
  return Array.isArray(value) && value.length === 3 && value.every(isString);
}

function isChoiceQuadruple(
  value: unknown
): value is [VocabularyChoice, VocabularyChoice, VocabularyChoice, VocabularyChoice] {
  return Array.isArray(value) && value.length === 4 && value.every(isVocabularyChoice);
}

const DEFINITION_DISPLAY_FIELDS = [
  "contentType",
  "nextCapability",
  "word",
  "definition",
  "exampleSentences",
] as const;
const DEFINITION_FUN_FACT_FIELDS = [
  "contentType",
  "nextCapability",
  "word",
  "interestingFact",
] as const;
const DEFINITION_PRACTICE_FIELDS = [
  "contentType",
  "nextCapability",
  "attemptId",
  "question",
  "choices",
] as const;
const SPELLING_PRACTICE_FIELDS = [
  "contentType",
  "nextCapability",
  "attemptId",
  "definition",
] as const;
const ANSWER_RECAP_CONTENT_FIELDS = [
  "contentType",
  "nextCapability",
  "word",
  "definition",
  "exampleSentence",
] as const;
const WORD_SEARCH_CHECKPOINT_CONTENT_FIELDS = [
  "contentType",
  "nextCapability",
  "words",
] as const;

function isVocabularyCapabilityContentResponse(
  value: unknown
): value is VocabularyCapabilityContentResponse {
  if (!isRecord(value) || !isString(value.nextCapability)) {
    return false;
  }

  switch (value.contentType) {
    case "definition-display":
      return (
        hasExactFields(value, DEFINITION_DISPLAY_FIELDS) &&
        isString(value.word) &&
        isString(value.definition) &&
        isExampleSentenceTriple(value.exampleSentences)
      );
    case "definition-fun-fact":
      return (
        hasExactFields(value, DEFINITION_FUN_FACT_FIELDS) &&
        isString(value.word) &&
        isString(value.interestingFact)
      );
    case "definition-practice":
      return (
        hasExactFields(value, DEFINITION_PRACTICE_FIELDS) &&
        isString(value.attemptId) &&
        isString(value.question) &&
        isChoiceQuadruple(value.choices)
      );
    case "spelling-practice":
      return (
        hasExactFields(value, SPELLING_PRACTICE_FIELDS) &&
        isString(value.attemptId) &&
        isString(value.definition)
      );
    case "answer-recap":
      return (
        hasExactFields(value, ANSWER_RECAP_CONTENT_FIELDS) &&
        isString(value.word) &&
        isString(value.definition) &&
        isString(value.exampleSentence)
      );
    case "word-search-checkpoint":
      return (
        hasExactFields(value, WORD_SEARCH_CHECKPOINT_CONTENT_FIELDS) &&
        isStringArray(value.words)
      );
    default:
      return false;
  }
}

const SCREEN_STEP_DEFINITION_DISPLAY_FIELDS = ["kind", "wordId"] as const;
const SCREEN_STEP_PRACTICE_FIELDS = ["kind", "wordId", "review"] as const;
const SCREEN_STEP_ANSWER_RECAP_FIELDS = ["kind", "wordId", "exampleIndex"] as const;
const SCREEN_STEP_CHECKPOINT_FIELDS = ["kind", "wordIds"] as const;

function isVocabularyScreenStep(value: unknown): value is VocabularyScreenStep {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.kind) {
    case "definition-display":
    case "definition-fun-fact":
      return (
        hasExactFields(value, SCREEN_STEP_DEFINITION_DISPLAY_FIELDS) &&
        isString(value.wordId)
      );
    case "definition-practice":
    case "spelling-practice":
      return (
        hasExactFields(value, SCREEN_STEP_PRACTICE_FIELDS) &&
        isString(value.wordId) &&
        isBoolean(value.review)
      );
    case "answer-recap":
      return (
        hasExactFields(value, SCREEN_STEP_ANSWER_RECAP_FIELDS) &&
        isString(value.wordId) &&
        isInteger(value.exampleIndex)
      );
    case "word-search-checkpoint":
      return (
        hasExactFields(value, SCREEN_STEP_CHECKPOINT_FIELDS) &&
        isStringArray(value.wordIds)
      );
    default:
      return false;
  }
}

const CAPABILITY_SNAPSHOT_FIELDS = [
  "schemaVersion",
  "userId",
  "lessonId",
  "listId",
  "step",
  "predecessor",
  "nextCapability",
  "contentResponse",
] as const;

export function parseCapabilityRuntimeSnapshot(
  value: unknown
): CapabilityRuntimeSnapshot | null {
  if (
    !isRecord(value) ||
    !hasExactFields(value, CAPABILITY_SNAPSHOT_FIELDS) ||
    value.schemaVersion !== RUNTIME_SNAPSHOT_SCHEMA_VERSION ||
    !isString(value.userId) ||
    !isString(value.lessonId) ||
    !isString(value.listId) ||
    (value.step !== null && !isVocabularyScreenStep(value.step)) ||
    !isNullableString(value.predecessor) ||
    !isNullableString(value.nextCapability) ||
    (value.contentResponse !== null &&
      !isVocabularyCapabilityContentResponse(value.contentResponse))
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    userId: value.userId,
    lessonId: value.lessonId,
    listId: value.listId,
    step: value.step,
    predecessor: value.predecessor,
    nextCapability: value.nextCapability,
    contentResponse: value.contentResponse,
  };
}

const ATTEMPT_INDEX_SNAPSHOT_FIELDS = [
  "schemaVersion",
  "lessonId",
  "successorCapability",
] as const;

export function parseAttemptIndexRuntimeSnapshot(
  value: unknown
): AttemptIndexRuntimeSnapshot | null {
  if (
    !isRecord(value) ||
    !hasExactFields(value, ATTEMPT_INDEX_SNAPSHOT_FIELDS) ||
    value.schemaVersion !== RUNTIME_SNAPSHOT_SCHEMA_VERSION ||
    !isString(value.lessonId) ||
    !isString(value.successorCapability)
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    lessonId: value.lessonId,
    successorCapability: value.successorCapability,
  };
}
