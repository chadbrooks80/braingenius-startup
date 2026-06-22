import { Check } from "lucide-react";

interface CheckBadgeProps {
  label: string;
  backgroundColor?: string;
  fontColor?: string;
  checkboxColor?: string;
}

export default function CheckBadge({
  label,
  backgroundColor,
  fontColor,
  checkboxColor,
}: CheckBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border"
      style={{
        backgroundColor: backgroundColor
          ? `var(${backgroundColor})`
          : "var(--color-white)",
        color: fontColor ? `var(${fontColor})` : "var(--color-text-primary)",
        borderColor: "var(--color-border-muted)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Check
        size={14}
        style={{
          color: checkboxColor
            ? `var(${checkboxColor})`
            : "var(--color-primary-cyan)",
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
