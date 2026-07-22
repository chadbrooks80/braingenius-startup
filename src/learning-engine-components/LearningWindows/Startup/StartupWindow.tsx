"use client";

import type { StartupScreenData, StartupButtonConfig, OnAction } from "@/types/learning";
import { Button } from "@/learning-engine-components/UI/Button";

export type StartupWindowProps = StartupScreenData & {
  onAction: OnAction;
};

export function StartupWindow({
  contentPanel,
  visualPanel,
  actionPanel,
  onAction,
}: StartupWindowProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="w-full max-w-[980px] rounded-3xl overflow-hidden bg-white/85 shadow-[0_16px_56px_var(--color-navy)] shadow-navy/13 border border-white/70 grid grid-cols-1 md:grid-cols-[1.22fr_310px]"
        style={{ backdropFilter: "blur(12px)" }}
      >
        {/* Left side: ContentPanel + ActionPanel — order-last on mobile so visual sits above */}
        <div className="flex flex-col gap-5 p-8 order-last md:order-first">
          {contentPanel}
          <ActionPanel buttons={actionPanel.buttons} onAction={onAction} />
        </div>

        {/* Right side: VisualPanel — order-first on mobile so it appears above content */}
        <div className="order-first md:order-last">{visualPanel}</div>
      </div>
    </div>
  );
}

/* ---------- ActionPanel ---------- */

type ActionPanelProps = {
  buttons: StartupButtonConfig[];
  onAction: OnAction;
};

function ActionPanel({ buttons, onAction }: ActionPanelProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {buttons.map((button) => (
        <Button
          key={button.id}
          label={button.label}
          variant={button.variant}
          trailingIcon={button.trailingIcon}
          helperText={button.helperText}
          onClick={() => onAction(button.actionId)}
        />
      ))}
    </div>
  );
}

export default StartupWindow;
