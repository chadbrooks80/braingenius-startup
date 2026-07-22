"use client";

import { Button } from "@/learning-engine-components/UI/Button";
import type { OnAction, TtsConfiguration } from "@/types/learning";

export type DefinitionDisplayProps = {
  eyebrow: string;
  title: string;
  primaryLabel: string;
  primaryText: string;
  secondaryLabel: string;
  secondaryItems: string[];
  replayLabel: string;
  replayText: string | string[];
  tts: TtsConfiguration;
  onAction: OnAction;
};

export function DefinitionDisplay({
  eyebrow,
  title,
  primaryLabel,
  primaryText,
  secondaryLabel,
  secondaryItems,
  replayLabel,
  replayText,
  tts,
  onAction,
}: DefinitionDisplayProps) {
  const visibleItems = secondaryItems.filter(
    (item) => item.trim() !== ""
  );

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="w-full max-w-lg rounded-3xl p-8 border border-white/70 bg-white/85 shadow-[0_16px_56px_var(--color-navy)] shadow-navy/13"
        style={{ backdropFilter: "blur(12px)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest mb-4 text-cyan-ink">
          {eyebrow}
        </p>

        {/* Word + speaker */}
        <div className="flex items-center gap-3 mb-6">
          <span className="font-display text-5xl font-extrabold text-navy">
            {title}
          </span>
          <button
            type="button"
            onClick={() => onAction("speak", { text: replayText, tts })}
            className="ml-auto cursor-pointer transition-colors hover:opacity-80 text-cyan"
            aria-label={replayLabel}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
              <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.348 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
              <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Definition */}
        <div className="rounded-2xl px-5 py-4 mb-4 border bg-cyan/13 border-cyan/34">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-cyan-ink">
            {primaryLabel}
          </p>
          <p className="font-medium leading-relaxed text-ink">
            {primaryText}
          </p>
        </div>

        {/* Example sentences */}
        <div className="rounded-2xl px-5 py-4 mb-8 border bg-lime/13 border-lime/34">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-lime-strong">
            {secondaryLabel}
          </p>
          <div className="space-y-2.5">
            {visibleItems.map((item, index) => (
              <p
                key={index}
                className="italic leading-relaxed text-sm text-muted"
              >
                {item}
              </p>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            label="Next →"
            variant="accent"
            onClick={() => onAction("next")}
          />
        </div>
      </div>
    </div>
  );
}

export default DefinitionDisplay;
