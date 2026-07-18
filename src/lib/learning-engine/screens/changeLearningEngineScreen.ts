import type {
  LearningEngineStateSetters,
  OnAction,
  ScreenRequest,
} from "@/types/learning";
import { resolveLearningWindow } from "@/lib/learning-engine/LearningWindowRegistry";
import { withSharedScreenProps } from "@/lib/learning-engine/screens/withSharedScreenProps";
import { cancelSpeech } from "@/lib/learning-engine/speech/speechPlaybackService";
import { runSpeakRequest } from "@/lib/learning-engine/speech/runSpeakRequest";

export function changeLearningEngineScreen(
  screenRequest: ScreenRequest,
  learningEngineStateSetters: LearningEngineStateSetters,
  onAction: OnAction
): void {
  cancelSpeech();
  learningEngineStateSetters.setIsSpeaking(false);

  const WindowComponent = resolveLearningWindow(
    screenRequest.windowName
  );

  learningEngineStateSetters.setAnswerFeedback(null);

  learningEngineStateSetters.setActiveScreen({
    WindowComponent,
    props: withSharedScreenProps(screenRequest.props, onAction),
  });

  if (screenRequest.speak) {
    runSpeakRequest(screenRequest.speak, learningEngineStateSetters);
  }
}
