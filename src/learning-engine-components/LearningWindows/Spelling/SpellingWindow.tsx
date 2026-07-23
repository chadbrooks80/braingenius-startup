"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/learning-engine-components/UI/Button";
import type { OnAction, SpeakActionPayload } from "@/types/learning";
import {
  IDLE_SPELLING_SUBMISSION_STATE,
  isSpellingSubmissionLocked,
  submitSpellingAnswer,
  type SpellingSubmissionState,
} from "./spellingSubmissionFlow";

export type SpellingWindowProps = {
  attemptId: string;
  badgeLabel: string;
  badgeTone: "primary" | "secondary";
  promptLabel: string;
  promptText: string;
  inputLabel: string;
  submitLabel: string;
  replayLabel: string;
  speech: SpeakActionPayload;
  blankMessage: string;
  pendingMessage: string;
  errorMessage: string;
  correctMessage: string;
  incorrectMessage: string;
  correctionLabel: string;
  feedback: SpellingFeedback | null;
  onAction: OnAction;
};

export type SpellingFeedback =
  | { correct: true }
  | { correct: false; correctAnswer: string };

export function SpellingWindow({
  attemptId,
  ...props
}: SpellingWindowProps) {
  return <SpellingAttempt key={attemptId} attemptId={attemptId} {...props} />;
}

function SpellingAttempt({
  attemptId,
  badgeLabel,
  badgeTone,
  promptLabel,
  promptText,
  inputLabel,
  submitLabel,
  replayLabel,
  speech,
  blankMessage,
  pendingMessage,
  errorMessage,
  correctMessage,
  incorrectMessage,
  correctionLabel,
  feedback,
  onAction,
}: SpellingWindowProps) {
  const [answer, setAnswer] = useState("");
  const [submissionState, setSubmissionState] =
    useState<SpellingSubmissionState>(IDLE_SPELLING_SUBMISSION_STATE);
  const [validationMessage, setValidationMessage] = useState("");
  const submissionStateRef = useRef<SpellingSubmissionState>(submissionState);
  const answered = feedback !== null;
  const locked = isSpellingSubmissionLocked(submissionState) || answered;

  function submitSpelling(event: FormEvent) {
    event.preventDefault();
    void submitAnswerValue(answer);
  }

  async function submitAnswerValue(rawAnswer: string) {
    if (isSpellingSubmissionLocked(submissionStateRef.current) || answered) {
      return;
    }

    const normalizedAnswer = rawAnswer.trim();
    if (normalizedAnswer === "") {
      setValidationMessage(blankMessage);
      return;
    }

    setValidationMessage("");
    await submitSpellingAnswer({
      answer: normalizedAnswer,
      stateRef: submissionStateRef,
      updateState: setSubmissionState,
      submitAnswer: () =>
        onAction("submitAnswer", {
          attemptId,
          answer: normalizedAnswer,
        }),
    });
  }

  function retrySubmission() {
    const retryAnswer = submissionState.answer ?? "";
    setAnswer(retryAnswer);
    void submitAnswerValue(retryAnswer);
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="w-full max-w-lg rounded-3xl p-8 border border-surface/74 bg-surface/85 shadow-[0_16px_56px] shadow-heading/13"
        style={{ backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <span
            className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${
              badgeTone === "secondary"
                ? "bg-feature/13 border-feature/34 text-feature"
                : "bg-primary/13 border-primary/34 text-primary-strong"
            }`}
          >
            {badgeLabel}
          </span>
          <button
            type="button"
            className="cursor-pointer text-primary"
            aria-label={replayLabel}
            onClick={() => onAction("speak", speech)}
          >
            <SpeakerIcon />
          </button>
        </div>

        <div className="rounded-2xl px-5 py-4 mb-5 border bg-primary/13 border-primary/34">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-primary-strong">
            {promptLabel}
          </p>
          <p className="font-medium leading-relaxed text-text">
            {promptText}
          </p>
        </div>

        <form onSubmit={submitSpelling}>
          <label
            htmlFor={`spelling-${attemptId}`}
            className="block text-sm font-bold mb-2 text-heading"
          >
            {inputLabel}
          </label>
          <div className="flex gap-3">
            <input
              id={`spelling-${attemptId}`}
              autoFocus
              value={answer}
              disabled={locked}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setAnswer(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-base outline-none disabled:opacity-74 border-heading/13 bg-surface text-text"
            />
            <button
              type="submit"
              disabled={locked}
              className="rounded-xl px-5 py-3 text-sm font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-48 text-heading bg-linear-[135deg] from-primary to-primary"
            >
              {submitLabel}
            </button>
          </div>
        </form>

        {validationMessage && (
          <p className="mt-3 text-sm font-semibold text-danger">
            {validationMessage}
          </p>
        )}

        {submissionState.status === "pending" && (
          <p className="mt-4 text-sm font-semibold text-muted">
            {pendingMessage}
          </p>
        )}

        {submissionState.status === "error" && (
          <div className="mt-4 flex items-center justify-between gap-4" role="alert">
            <p className="text-sm font-semibold text-danger">
              {errorMessage}
            </p>
            <Button label="Retry" variant="secondary" onClick={retrySubmission} />
          </div>
        )}

        {feedback && (
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p
                className={`font-bold text-sm ${
                  feedback.correct ? "text-secondary-strong" : "text-danger"
                }`}
              >
                {feedback.correct ? correctMessage : incorrectMessage}
              </p>
              {!feedback.correct && (
                <p className="mt-1 text-sm text-text">
                  {correctionLabel}: <strong>{feedback.correctAnswer}</strong>
                </p>
              )}
            </div>
            <Button label="Next →" variant="accent" onClick={() => onAction("next")} />
          </div>
        )}
      </div>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.348 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
      <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

export default SpellingWindow;
