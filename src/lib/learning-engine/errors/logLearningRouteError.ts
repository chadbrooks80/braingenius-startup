import type { LearningRouteError } from "@/lib/learning-engine/errors/LearningRouteError";

export function logLearningRouteError(
  error: LearningRouteError,
  moduleName: string,
  moduleVariables: string[],
  routePath: string
): void {
  console.warn("Learning route error", {
    event: "learning_route_error",
    code: error.code,
    moduleName,
    moduleVariables,
    routePath,
    technicalMessage: error.message,
    occurredAt: new Date().toISOString(),
  });
}
