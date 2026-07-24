import { Check } from "lucide-react";
import { getColorClass, type ColorTokenFor } from "@/lib/theme-colors";

interface CheckBadgeProps {
  label: string;
  backgroundColor?: ColorTokenFor<"bg">;
  fontColor?: ColorTokenFor<"text">;
  checkboxColor?: ColorTokenFor<"text">;
}

export default function CheckBadge({
  label,
  backgroundColor = "surface",
  fontColor = "text",
  checkboxColor = "primary",
}: CheckBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border border-heading/(--alpha-soft) shadow-sm ${getColorClass(backgroundColor, "bg")} ${getColorClass(fontColor, "text")}`}
    >
      <Check
        size={14}
        className={`shrink-0 ${getColorClass(checkboxColor, "text")}`}
      />
      {label}
    </span>
  );
}
