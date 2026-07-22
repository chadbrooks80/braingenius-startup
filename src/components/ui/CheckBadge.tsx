import { Check } from "lucide-react";
import { getColorClass, type ColorToken } from "@/lib/theme-colors";

interface CheckBadgeProps {
  label: string;
  backgroundColor?: ColorToken;
  fontColor?: ColorToken;
  checkboxColor?: ColorToken;
}

export default function CheckBadge({
  label,
  backgroundColor = "white",
  fontColor = "text-primary",
  checkboxColor = "primary",
}: CheckBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border border-border-muted shadow-sm ${getColorClass(backgroundColor, "bg")} ${getColorClass(fontColor, "text")}`}
    >
      <Check
        size={14}
        className={`shrink-0 ${getColorClass(checkboxColor, "text")}`}
      />
      {label}
    </span>
  );
}
