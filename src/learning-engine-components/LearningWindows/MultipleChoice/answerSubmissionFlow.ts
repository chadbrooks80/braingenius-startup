export type AnswerSubmissionState =
  | { status: "idle"; selectedChoiceId: null }
  | { status: "pending"; selectedChoiceId: string }
  | { status: "success"; selectedChoiceId: string }
  | { status: "error"; selectedChoiceId: string };

export const IDLE_ANSWER_SUBMISSION_STATE: AnswerSubmissionState = {
  status: "idle",
  selectedChoiceId: null,
};

type AnswerSubmissionStateRef = {
  current: AnswerSubmissionState;
};

type SubmitMultipleChoiceAnswerOptions = {
  selectedChoiceId: string;
  stateRef: AnswerSubmissionStateRef;
  updateState: (state: AnswerSubmissionState) => void;
  submitAnswer: () => void | Promise<void>;
};

export function isAnswerSubmissionLocked(
  state: AnswerSubmissionState
): boolean {
  return state.status === "pending" || state.status === "success";
}

export async function submitMultipleChoiceAnswer({
  selectedChoiceId,
  stateRef,
  updateState,
  submitAnswer,
}: SubmitMultipleChoiceAnswerOptions): Promise<boolean> {
  if (isAnswerSubmissionLocked(stateRef.current)) {
    return false;
  }

  const setState = (state: AnswerSubmissionState) => {
    stateRef.current = state;
    updateState(state);
  };

  setState({ status: "pending", selectedChoiceId });

  try {
    await submitAnswer();
    setState({ status: "success", selectedChoiceId });
    return true;
  } catch {
    setState({ status: "error", selectedChoiceId });
    return false;
  }
}
