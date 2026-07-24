"use client";

import type {
  StartupScreenData,
  StartupButtonConfig,
  StartupButtonVariant,
  OnAction,
} from "@/types/learning";
import Button, { type ButtonVariant } from "@/components/ui/Button";

const STARTUP_BUTTON_VARIANT_MAP: Record<StartupButtonVariant, ButtonVariant> = {
  primary: "learning-primary",
  secondary: "learning-secondary",
  ghost: "learning-ghost",
};

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
        className="w-full max-w-[980px] rounded-3xl overflow-hidden bg-surface/(--alpha-surface-strong) shadow-[0_16px_56px] shadow-heading/(--alpha-subtle) border border-surface/(--alpha-surface) grid grid-cols-1 md:grid-cols-[1.22fr_310px] backdrop-blur-(--blur-glass)"
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
          variant={STARTUP_BUTTON_VARIANT_MAP[button.variant]}
          trailingIcon={button.trailingIcon}
          helperText={button.helperText}
          onClick={() => onAction(button.actionId)}
        >
          {button.label}
        </Button>
      ))}
    </div>
  );
}

export default StartupWindow;
