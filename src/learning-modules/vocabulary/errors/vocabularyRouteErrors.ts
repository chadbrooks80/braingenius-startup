import { LearningRouteError } from "@/lib/learning-engine/errors/LearningRouteError";

const VOCABULARY_ROUTE_ERROR_CODES = {
  LEARNING_ID_MISSING: "VOCABULARY_LEARNING_ID_MISSING",
  LEARNING_NOT_FOUND: "VOCABULARY_LEARNING_NOT_FOUND",
  ROUTE_INVALID: "VOCABULARY_ROUTE_INVALID",
} as const;

export function createVocabularyLearningIdMissingError(): LearningRouteError {
  return new LearningRouteError({
    source: "module",
    kind: "MODULE_RESOURCE_MISSING",
    code: VOCABULARY_ROUTE_ERROR_CODES.LEARNING_ID_MISSING,
    technicalMessage: "Vocabulary route omitted the required learning ID.",
    presentation: {
      title: "Vocabulary List Not Found",
      message: "This lesson link does not include a vocabulary list.",
    },
  });
}

export function createVocabularyLearningNotFoundError(
  learningId: string
): LearningRouteError {
  return new LearningRouteError({
    source: "module",
    kind: "MODULE_RESOURCE_NOT_FOUND",
    code: VOCABULARY_ROUTE_ERROR_CODES.LEARNING_NOT_FOUND,
    technicalMessage: `Vocabulary learning not found or not authorized: ${learningId}`,
    presentation: {
      title: "Vocabulary List Not Found",
      message: "We could not find the vocabulary list requested by this link.",
    },
  });
}

export function createInvalidVocabularyRouteError(): LearningRouteError {
  return new LearningRouteError({
    source: "module",
    kind: "INVALID_MODULE_ROUTE",
    code: VOCABULARY_ROUTE_ERROR_CODES.ROUTE_INVALID,
    technicalMessage:
      "Vocabulary route contains unexpected extra path segments.",
    presentation: {
      title: "Invalid Lesson Link",
      message: "This lesson link has an invalid format.",
    },
  });
}
