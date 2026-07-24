import { ReactNode } from "react";
import { clsx } from "clsx";

export type LearningWindowShellSize = "standard" | "wide";
export type LearningWindowShellAlign = "start" | "center";

export type LearningWindowShellProps = {
  size?: LearningWindowShellSize;
  align?: LearningWindowShellAlign;
  backdrop?: boolean;
  children: ReactNode;
};

const sizeClasses: Record<LearningWindowShellSize, string> = {
  standard: "max-w-lg",
  wide: "max-w-2xl",
};

const alignClasses: Record<LearningWindowShellAlign, string> = {
  start: "",
  center: "text-center",
};

export function LearningWindowShell({
  size = "standard",
  align = "start",
  backdrop = true,
  children,
}: LearningWindowShellProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className={clsx(
          "w-full rounded-3xl p-8 border border-surface/(--alpha-surface) bg-surface/(--alpha-surface-strong) shadow-[0_16px_56px] shadow-heading/(--alpha-subtle)",
          sizeClasses[size],
          alignClasses[align],
          backdrop && "backdrop-blur-(--blur-glass)"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default LearningWindowShell;
