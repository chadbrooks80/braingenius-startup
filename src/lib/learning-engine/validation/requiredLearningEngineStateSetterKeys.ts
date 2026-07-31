import type { LearningEngineStateSetters } from "@/types/learning";

export const requiredLearningEngineStateSetterKeys: (keyof LearningEngineStateSetters)[] = [
  "setActiveScreen",
  "setShowHeader",
  "setModuleLayout",
  "setAnswerFeedback",
  "setIsSpeaking",
  "setSpeechFailureNotice",
];
