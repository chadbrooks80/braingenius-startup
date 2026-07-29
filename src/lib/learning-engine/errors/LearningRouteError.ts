export type LearningRouteErrorSource = "engine" | "module";

export type LearningRouteErrorKind =
  | "MODULE_NOT_FOUND"
  | "MODULE_RESOURCE_MISSING"
  | "MODULE_RESOURCE_NOT_FOUND"
  | "INVALID_MODULE_ROUTE";

export type LearningRouteErrorPresentation = {
  readonly title: string;
  readonly message: string;
};

export type LearningRouteErrorOptions = {
  readonly source: LearningRouteErrorSource;
  readonly kind: LearningRouteErrorKind;
  readonly code: string;
  readonly technicalMessage: string;
  readonly presentation: LearningRouteErrorPresentation;
};

export class LearningRouteError extends Error {
  readonly source: LearningRouteErrorSource;
  readonly kind: LearningRouteErrorKind;
  readonly code: string;
  readonly presentation: LearningRouteErrorPresentation;

  constructor(options: LearningRouteErrorOptions) {
    super(options.technicalMessage);
    this.name = "LearningRouteError";
    this.source = options.source;
    this.kind = options.kind;
    this.code = options.code;
    this.presentation = options.presentation;
  }
}

export const LEARNING_ROUTE_ERROR_HOME_PATH = "/";
