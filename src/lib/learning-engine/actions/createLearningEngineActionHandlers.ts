import type {
  ActionHandlers,
  ActionPayload,
  ActiveModule,
  LearningEngineStateSetters,
} from "@/types/learning";
import { runSpeakRequest } from "@/lib/learning-engine/speech/runSpeakRequest";

type CreateLearningEngineActionHandlersParams = {
  getActiveModule: () => ActiveModule;
  getLearningEngineStateSetters: () => LearningEngineStateSetters;
};

export function createLearningEngineActionHandlers({
  getActiveModule,
  getLearningEngineStateSetters,
}: CreateLearningEngineActionHandlersParams): ActionHandlers {
  return {
    next: () => getActiveModule().next(),
    submitAnswer: async (payload: ActionPayload) => {
      const result = await getActiveModule().submitAnswer(payload);

      getLearningEngineStateSetters().setAnswerFeedback(result);
    },
    speak: (payload: ActionPayload) => {
      runSpeakRequest(payload, getLearningEngineStateSetters());
    },
  };
}
