"use client";

import Button from "@/components/ui/Button";
import { LearningWindowShell } from "@/components/learning-engine/LearningWindowShell";
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
    <LearningWindowShell>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-secondary-strong">
        {eyebrow}
      </p>

      <div className="flex items-center gap-3 mb-6">
        <span className="font-display text-3xl font-extrabold text-heading">
          {title}
        </span>
      </div>

      <div className="rounded-2xl px-6 py-6 mb-8 border border-secondary/(--alpha-medium) bg-linear-135/srgb from-secondary/(--alpha-subtle) to-primary/(--alpha-subtle)">
        <p className="text-sm font-bold mb-3 text-secondary-strong">
          {introLabel}
        </p>
        <p className="leading-relaxed font-medium text-text">
          {body}
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          variant="learning-accent"
          onClick={() => onAction("next")}
        >
          Next →
        </Button>
      </div>
    </LearningWindowShell>
  );
}

export default DefinitionFunFact;
