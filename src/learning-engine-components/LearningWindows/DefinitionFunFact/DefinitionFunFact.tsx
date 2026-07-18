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
        className="w-full max-w-lg rounded-3xl p-8 border border-white/70 shadow-[0_16px_56px_var(--shadow-card)]"
        style={{
          background: "var(--surface-strong)",
          backdropFilter: "blur(12px)",
        }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-2"
          style={{ color: "var(--lime-strong)" }}
        >
          {eyebrow}
        </p>

        <div className="flex items-center gap-3 mb-6">
          <span
            className="font-display text-3xl font-extrabold"
            style={{ color: "var(--navy)" }}
          >
            {title}
          </span>
        </div>

        <div
          className="rounded-2xl px-6 py-6 mb-8"
          style={{
            background:
              "linear-gradient(135deg, var(--tint-lime), var(--tint-cyan))",
            border: "1px solid var(--border-lime)",
          }}
        >
          <p
            className="text-sm font-bold mb-3"
            style={{ color: "var(--lime-strong)" }}
          >
            {introLabel}
          </p>
          <p className="leading-relaxed font-medium" style={{ color: "var(--ink)" }}>
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
