import { LearningRouteError } from "@/lib/learning-engine/errors/LearningRouteError";

export function createLearningModuleNotFoundError(
  moduleName: string
): LearningRouteError {
  return new LearningRouteError({
    source: "engine",
    kind: "MODULE_NOT_FOUND",
    code: "LEARNING_MODULE_NOT_FOUND",
    technicalMessage: `Unknown learning module requested: ${moduleName}`,
    presentation: {
      title: "Lesson Not Found",
      message: "We could not find the lesson requested by this link.",
    },
  });
}
