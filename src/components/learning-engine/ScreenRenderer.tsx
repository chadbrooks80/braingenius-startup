import type { ActiveScreen, AnswerFeedback } from "@/types/learning";

type ScreenRendererProps = {
  screen: ActiveScreen;
  answerFeedback: AnswerFeedback | null;
  isSpeaking: boolean;
};

export function ScreenRenderer({
  screen,
  answerFeedback,
  isSpeaking,
}: ScreenRendererProps) {
  const WindowComponent = screen.WindowComponent;

  return (
    <WindowComponent
      {...(screen.props as Record<string, unknown>)}
      feedback={answerFeedback}
      isSpeaking={isSpeaking}
    />
  );
}
