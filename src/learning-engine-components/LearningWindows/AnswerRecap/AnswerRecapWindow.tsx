"use client";

import Button from "@/components/ui/Button";
import { LearningWindowShell } from "@/learning-engine-components/UI/LearningWindowShell";
import type { OnAction, TtsConfiguration } from "@/types/learning";

export type AnswerRecapWindowProps = {
  label: string;
  title: string;
  primaryText: string;
  secondaryText: string;
  replayLabel: string;
  playingMessage: string;
  completeMessage: string;
  speechText: string[];
  tts: TtsConfiguration;
  isSpeaking: boolean;
  onAction: OnAction;
};

export function AnswerRecapWindow({
  label,
  title,
  primaryText,
  secondaryText,
  replayLabel,
  playingMessage,
  completeMessage,
  speechText,
  tts,
  isSpeaking,
  onAction,
}: AnswerRecapWindowProps) {
  return (
    <LearningWindowShell>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-primary-strong">
        {label}
      </p>

      <div className="flex items-center gap-3 mb-5">
        <h2 className="font-display text-4xl font-extrabold text-heading">
          {title}
        </h2>
        <button
          type="button"
          className="ml-auto cursor-pointer text-link"
          aria-label={replayLabel}
          onClick={() => onAction("speak", { text: speechText, tts })}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.348 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
            <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>
      </div>

      <div className="rounded-2xl px-5 py-4 mb-4 border bg-primary/(--alpha-subtle) border-primary/(--alpha-medium)">
        <p className="font-medium leading-relaxed text-text">
          {primaryText}
        </p>
      </div>

      <p className="italic leading-relaxed mb-7 text-muted">
        {secondaryText}
      </p>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold text-muted">
          {isSpeaking ? playingMessage : completeMessage}
        </p>
        <Button
          variant="learning-accent"
          disabled={isSpeaking}
          onClick={() => onAction("next")}
        >
          Next →
        </Button>
      </div>
    </LearningWindowShell>
  );
}

export default AnswerRecapWindow;
