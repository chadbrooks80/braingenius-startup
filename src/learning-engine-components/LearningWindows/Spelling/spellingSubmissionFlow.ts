export type SpellingSubmissionState =
  | { status: "idle"; answer: null }
  | { status: "pending"; answer: string }
  | { status: "success"; answer: string }
  | { status: "error"; answer: string };

export const IDLE_SPELLING_SUBMISSION_STATE: SpellingSubmissionState = {
  status: "idle",
  answer: null,
};

type SpellingSubmissionStateRef = {
  current: SpellingSubmissionState;
};

type SubmitSpellingAnswerOptions = {
  answer: string;
  stateRef: SpellingSubmissionStateRef;
  updateState: (state: SpellingSubmissionState) => void;
  submitAnswer: () => void | Promise<void>;
};

export function isSpellingSubmissionLocked(
  state: SpellingSubmissionState
): boolean {
  return state.status === "pending" || state.status === "success";
}

export async function submitSpellingAnswer({
  answer,
  stateRef,
  updateState,
  submitAnswer,
}: SubmitSpellingAnswerOptions): Promise<boolean> {
  if (isSpellingSubmissionLocked(stateRef.current)) {
    return false;
  }

  const setState = (state: SpellingSubmissionState) => {
    stateRef.current = state;
    updateState(state);
  };

  setState({ status: "pending", answer });

  try {
    await submitAnswer();
    setState({ status: "success", answer });
    return true;
  } catch {
    setState({ status: "error", answer });
    return false;
  }
}
