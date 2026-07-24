import type { OnAction, TtsConfiguration } from "@/types/learning";

type MultipleChoiceActionsOptions = {
  attemptId: string;
  question: string;
  tts: TtsConfiguration | null;
  onAction: OnAction;
};

export type MultipleChoiceActions = {
  hearPronunciation: (() => void | Promise<void>) | null;
  submitAnswer: (selectedChoiceId: string) => void | Promise<void>;
};

export function getMultipleChoiceActions({
  attemptId,
  question,
  tts,
  onAction,
}: MultipleChoiceActionsOptions): MultipleChoiceActions {
  return {
    hearPronunciation:
      tts === null
        ? null
        : () => onAction("speak", { text: question, tts }),
    submitAnswer: (selectedChoiceId) =>
      onAction("submitAnswer", {
        attemptId,
        selectedChoiceId,
      }),
  };
}
