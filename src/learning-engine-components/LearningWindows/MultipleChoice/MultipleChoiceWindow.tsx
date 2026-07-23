"use client";

import { useRef, useState } from "react";
import { Button } from "@/learning-engine-components/UI/Button";
import {
  IDLE_ANSWER_SUBMISSION_STATE,
  isAnswerSubmissionLocked,
  submitMultipleChoiceAnswer,
  type AnswerSubmissionState,
} from "./answerSubmissionFlow";
import { getMultipleChoiceActions } from "./getMultipleChoiceActions";
import type { OnAction, TtsConfiguration } from "@/types/learning";

export type MultipleChoiceChoice = {
  id: string;
  text: string;
};

export type MultipleChoiceFeedback = {
  correctChoiceId: string;
};

export type MultipleChoiceBadgeTone = "primary" | "secondary";

export type MultipleChoiceWindowProps = {
  attemptId: string;
  badgeLabel: string;
  badgeTone: MultipleChoiceBadgeTone;
  prompt: string;
  question: string;
  choices: MultipleChoiceChoice[];
  tts: TtsConfiguration | null;
  replayLabel: string;
  correctMessage: string;
  incorrectMessage: string;
  feedback: MultipleChoiceFeedback | null;
  onAction: OnAction;
};

export function MultipleChoiceWindow({
  attemptId,
  ...props
}: MultipleChoiceWindowProps) {
  return <MultipleChoiceAttempt key={attemptId} attemptId={attemptId} {...props} />;
}

function MultipleChoiceAttempt({
  attemptId,
  badgeLabel,
  badgeTone,
  prompt,
  question,
  choices,
  tts,
  replayLabel,
  correctMessage,
  incorrectMessage,
  feedback,
  onAction,
}: MultipleChoiceWindowProps) {
  const [submissionState, setSubmissionState] = useState<AnswerSubmissionState>(
    IDLE_ANSWER_SUBMISSION_STATE
  );
  const submissionStateRef = useRef<AnswerSubmissionState>(submissionState);

  const correctChoiceId = feedback?.correctChoiceId ?? null;
  const answered = correctChoiceId !== null;
  const selectedChoiceId = submissionState.selectedChoiceId;
  const interactionLocked =
    isAnswerSubmissionLocked(submissionState) || answered;
  const isSelectedAnswerCorrect = selectedChoiceId === correctChoiceId;
  const actions = getMultipleChoiceActions({
    attemptId,
    question,
    tts,
    onAction,
  });

  function updateSubmissionState(state: AnswerSubmissionState) {
    submissionStateRef.current = state;
    setSubmissionState(state);
  }

  function submitSelectedChoice(choiceId: string) {
    if (interactionLocked) {
      return;
    }

    void submitMultipleChoiceAnswer({
      selectedChoiceId: choiceId,
      stateRef: submissionStateRef,
      updateState: updateSubmissionState,
      submitAnswer: () => actions.submitAnswer(choiceId),
    });
  }

  function retrySelectedChoice() {
    if (submissionState.status !== "error") {
      return;
    }

    submitSelectedChoice(submissionState.selectedChoiceId);
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="w-full max-w-lg rounded-3xl p-8 border border-surface/(--alpha-surface) bg-surface/(--alpha-surface-strong) shadow-[0_16px_56px] shadow-heading/(--alpha-subtle)"
        style={{ backdropFilter: "blur(12px)" }}
      >
        {/* Badge */}
        <div className="flex items-center justify-between mb-4">
          <span
            className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${
              badgeTone === "secondary"
                ? "bg-feature/(--alpha-subtle) border-feature/(--alpha-medium) text-feature"
                : "bg-primary/(--alpha-subtle) border-primary/(--alpha-medium) text-primary-strong"
            }`}
          >
            {badgeLabel}
          </span>
        </div>

        {/* Word box */}
        <div className="rounded-2xl px-5 py-4 mb-5 border bg-primary/(--alpha-subtle) border-primary/(--alpha-medium)">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-primary-strong">
            {prompt}
          </p>
          <div className="flex items-center gap-3">
            <span className="font-display text-4xl font-extrabold text-heading">
              {question}
            </span>
            {actions.hearPronunciation !== null && (
              <button
                type="button"
                className="ml-auto cursor-pointer text-primary"
                aria-label={replayLabel}
                onClick={actions.hearPronunciation}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-7 h-7"
                >
                  <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.348 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                  <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Choices */}
        <div className="space-y-2.5">
          {choices.map((choice) => (
            <ChoiceRow
              key={choice.id}
              text={choice.text}
              answered={answered}
              disabled={interactionLocked}
              isCorrect={choice.id === correctChoiceId}
              isSelected={choice.id === selectedChoiceId}
              onClick={() => submitSelectedChoice(choice.id)}
            />
          ))}
        </div>

        {submissionState.status === "pending" && (
          <p className="mt-4 text-sm font-semibold text-muted">
            Checking your answer…
          </p>
        )}

        {submissionState.status === "error" && (
          <div className="mt-4 flex items-center justify-between gap-4" role="alert">
            <p className="text-sm font-semibold text-danger">
              We couldn&apos;t submit your answer. Please try again.
            </p>
            <Button
              label="Retry"
              variant="secondary"
              onClick={retrySelectedChoice}
            />
          </div>
        )}

        {/* Feedback row */}
        {answered && (
          <div className="mt-5 flex items-center justify-between">
            <span
              className={`font-bold text-sm ${
                isSelectedAnswerCorrect ? "text-secondary-strong" : "text-danger"
              }`}
            >
              {isSelectedAnswerCorrect ? correctMessage : incorrectMessage}
            </span>
            <Button
              label="Next →"
              variant="accent"
              onClick={() => onAction("next")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- ChoiceRow ---------- */

type ChoiceRowProps = {
  text: string;
  answered: boolean;
  disabled: boolean;
  isCorrect: boolean;
  isSelected: boolean;
  onClick: () => void;
};

function ChoiceRow({
  text,
  answered,
  disabled,
  isCorrect,
  isSelected,
  onClick,
}: ChoiceRowProps) {
  const choiceClass = !answered
    ? "bg-surface border-heading/(--alpha-subtle) text-text"
    : isCorrect
      ? "bg-secondary/(--alpha-subtle) border-secondary text-secondary-strong"
      : isSelected
        ? "bg-danger/(--alpha-subtle) border-danger text-heading"
        : "bg-surface/(--alpha-surface-soft) border-heading/(--alpha-hairline) text-muted";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium cursor-pointer disabled:cursor-default ${choiceClass}`}
    >
      {text}
    </button>
  );
}

export default MultipleChoiceWindow;
