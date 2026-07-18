import type { LearningEngineStateSetters } from "@/types/learning";
import { requiredLearningEngineStateSetterKeys } from "@/lib/learning-engine/validation/requiredLearningEngineStateSetterKeys";

export function validateLearningEngineStateSetters(
  learningEngineStateSetters: LearningEngineStateSetters
): void {
  for (const key of requiredLearningEngineStateSetterKeys) {
    if (typeof learningEngineStateSetters[key] !== "function") {
      throw new Error(`Missing required Learning Engine state setter: ${key}`);
    }
  }
}
