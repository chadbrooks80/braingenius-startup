import assert from "node:assert/strict";
import test from "node:test";
import { LearningRouteError } from "../../src/lib/learning-engine/errors/LearningRouteError";
import {
  createInvalidVocabularyRouteError,
  createVocabularyLearningIdMissingError,
  createVocabularyLearningNotFoundError,
} from "../../src/learning-modules/vocabulary/errors/vocabularyRouteErrors";

test("creates the module-owned missing-learning-id route error", () => {
  const error = createVocabularyLearningIdMissingError();

  assertRouteError(error, {
    kind: "MODULE_RESOURCE_MISSING",
    code: "VOCABULARY_LEARNING_ID_MISSING",
    technicalMessage: "Vocabulary route omitted the required learning ID.",
    title: "Vocabulary List Not Found",
    message: "This lesson link does not include a vocabulary list.",
  });
  assertPresentationExcludes(error, [error.message]);
});

test("creates the module-owned learning-not-found route error without exposing the learning ID", () => {
  const learningId = "private-learning-diagnostic-42";
  const error = createVocabularyLearningNotFoundError(learningId);

  assertRouteError(error, {
    kind: "MODULE_RESOURCE_NOT_FOUND",
    code: "VOCABULARY_LEARNING_NOT_FOUND",
    technicalMessage: `Vocabulary learning not found or not authorized: ${learningId}`,
    title: "Vocabulary List Not Found",
    message: "We could not find the vocabulary list requested by this link.",
  });
  assertPresentationExcludes(error, [learningId, error.message]);
});

test("creates the module-owned invalid-route error", () => {
  const error = createInvalidVocabularyRouteError();

  assertRouteError(error, {
    kind: "INVALID_MODULE_ROUTE",
    code: "VOCABULARY_ROUTE_INVALID",
    technicalMessage:
      "Vocabulary route contains unexpected extra path segments.",
    title: "Invalid Lesson Link",
    message: "This lesson link has an invalid format.",
  });
  assertPresentationExcludes(error, [error.message]);
});

function assertRouteError(
  error: LearningRouteError,
  expected: {
    kind: LearningRouteError["kind"];
    code: string;
    technicalMessage: string;
    title: string;
    message: string;
  }
): void {
  assert.ok(error instanceof LearningRouteError);
  assert.ok(error instanceof Error);
  assert.equal(error.name, "LearningRouteError");
  assert.equal(error.source, "module");
  assert.equal(error.kind, expected.kind);
  assert.equal(error.code, expected.code);
  assert.equal(error.message, expected.technicalMessage);
  assert.deepEqual(error.presentation, {
    title: expected.title,
    message: expected.message,
  });
}

function assertPresentationExcludes(
  error: LearningRouteError,
  unsafeValues: string[]
): void {
  const serializedPresentation = JSON.stringify(error.presentation);
  for (const unsafeValue of unsafeValues) {
    assert.doesNotMatch(serializedPresentation, new RegExp(unsafeValue));
  }
}
