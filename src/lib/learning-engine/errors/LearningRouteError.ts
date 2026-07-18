export type LearningRouteErrorCode =
  | "LEARNING_MODULE_NOT_FOUND"
  | "VOCABULARY_LIST_ID_MISSING"
  | "VOCABULARY_LIST_NOT_FOUND"
  | "INVALID_LEARNING_ROUTE";

export class LearningRouteError extends Error {
  readonly code: LearningRouteErrorCode;

  constructor(code: LearningRouteErrorCode, message: string) {
    super(message);
    this.name = "LearningRouteError";
    this.code = code;
  }
}

export type LearningRouteErrorPresentation = {
  title: string;
  message: string;
};

export const LEARNING_ROUTE_ERROR_HOME_PATH = "/";

const LEARNING_ROUTE_ERROR_PRESENTATIONS: Record<
  LearningRouteErrorCode,
  LearningRouteErrorPresentation
> = {
  LEARNING_MODULE_NOT_FOUND: {
    title: "Lesson Not Found",
    message: "We could not find the lesson requested by this link.",
  },
  VOCABULARY_LIST_ID_MISSING: {
    title: "Vocabulary List Not Found",
    message: "This lesson link does not include a vocabulary list.",
  },
  VOCABULARY_LIST_NOT_FOUND: {
    title: "Vocabulary List Not Found",
    message: "We could not find the vocabulary list requested by this link.",
  },
  INVALID_LEARNING_ROUTE: {
    title: "Invalid Lesson Link",
    message: "This lesson link has an invalid format.",
  },
};

export function getLearningRouteErrorPresentation(
  code: LearningRouteErrorCode
): LearningRouteErrorPresentation {
  return LEARNING_ROUTE_ERROR_PRESENTATIONS[code];
}
