"use client";

import { Button } from "@/learning-engine-components/UI/Button";
import type { OnAction } from "@/types/learning";

export type DefinitionFunFactProps = {
  eyebrow: string;
  title: string;
  introLabel: string;
  body: string;
  onAction: OnAction;
};

export function DefinitionFunFact({
  eyebrow,
  title,
  introLabel,
  body,
  onAction,
}: DefinitionFunFactProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="w-full max-w-lg rounded-3xl p-8 border border-surface/74 bg-surface/85 shadow-[0_16px_56px] shadow-heading/13"
        style={{ backdropFilter: "blur(12px)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-secondary-strong">
          {eyebrow}
        </p>

        <div className="flex items-center gap-3 mb-6">
          <span className="font-display text-3xl font-extrabold text-heading">
            {title}
          </span>
        </div>

        <div className="rounded-2xl px-6 py-6 mb-8 border border-secondary/34 bg-linear-135/srgb from-secondary/13 to-primary/13">
          <p className="text-sm font-bold mb-3 text-secondary-strong">
            {introLabel}
          </p>
          <p className="leading-relaxed font-medium text-text">
            {body}
          </p>
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

export default DefinitionFunFact;
