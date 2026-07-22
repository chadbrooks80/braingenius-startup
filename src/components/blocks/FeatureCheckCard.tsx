import React from "react";
import { Check } from "lucide-react";
import { getColorClass, type ColorToken } from "@/lib/theme-colors";

interface FeatureCheckCardProps {
  icon: React.ReactNode;
  iconBackgroundColor: ColorToken;
  title: string;
  children: React.ReactNode;
  checkItems: string[];
  backgroundColor?: ColorToken;
  fontColor?: ColorToken;
  checkboxColor?: ColorToken;
}

export default function FeatureCheckCard({
  icon,
  iconBackgroundColor,
  title,
  children,
  checkItems,
  backgroundColor = "white",
  fontColor = "dark",
  checkboxColor = "primary",
}: FeatureCheckCardProps) {
  const fontClass = getColorClass(fontColor, "text");

  return (
    <div
      className={`h-full rounded-[1.5rem] p-8 shadow-lg border border-(--color-border-soft) ${getColorClass(backgroundColor, "bg")} flex flex-col transition-transform duration-[250ms] hover:-translate-y-[5px]`}
    >
      <div
        className={`w-14 h-14 rounded-[16px] flex items-center justify-center mb-[1.2rem] ${getColorClass(iconBackgroundColor, "iconBg")}`}
      >
        {icon}
      </div>

      <h3
        className={`font-display text-[1.1rem] font-extrabold mb-[0.6rem] ${fontClass}`}
      >
        {title}
      </h3>

      <p className={`flex-1 text-[0.91rem] leading-[1.65] ${fontClass} opacity-75`}>
        {children}
      </p>

      <ul className="flex flex-col gap-2 mt-4">
        {checkItems.map((item, index) => (
          <li
            key={index}
            className={`flex items-center gap-2 text-[0.85rem] ${fontClass}`}
          >
            <Check
              size={14}
              strokeWidth={3}
              className={`shrink-0 ${getColorClass(checkboxColor, "text")}`}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
