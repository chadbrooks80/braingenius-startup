import { ReactNode } from "react";
import { getColorClass, type ColorToken } from "@/lib/theme-colors";

interface EyebrowProps {
  bgColor?: ColorToken;
  textColor?: ColorToken;
  children: ReactNode;
}

export default function Eyebrow({
  bgColor = "primary",
  textColor = "text-primary",
  children,
}: EyebrowProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-[0.85rem] py-[0.35rem] rounded-(--radius-full) border text-[0.75rem] font-bold tracking-[0.15em] uppercase ${getColorClass(bgColor, "tintBg")} ${getColorClass(textColor, "text")} ${getColorClass(textColor, "tintBorder")}`}
    >
      {children}
    </span>
  );
}
