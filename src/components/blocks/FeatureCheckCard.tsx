import React from "react";
import { Check } from "lucide-react";

interface FeatureCheckCardProps {
  icon: React.ReactNode;
  iconBackgroundColor: string;
  title: string;
  children: React.ReactNode;
  checkItems: string[];
  backgroundColor?: string;
  fontColor?: string;
  checkboxColor?: string;
}

export default function FeatureCheckCard({
  icon,
  iconBackgroundColor,
  title,
  children,
  checkItems,
  backgroundColor,
  fontColor,
  checkboxColor,
}: FeatureCheckCardProps) {
  return (
    <div
      style={
        {
          "--fcc-icon-bg": iconBackgroundColor,
          "--fcc-bg": backgroundColor ? `var(--${backgroundColor})` : "var(--color-white)",
          "--fcc-font": fontColor ? `var(--${fontColor})` : "var(--color-dark)",
          "--fcc-check": checkboxColor
            ? `var(--${checkboxColor})`
            : "var(--color-primary-cyan)",
        } as React.CSSProperties
      }
      className="h-full rounded-[1.5rem] p-8 shadow-[var(--shadow-lg)] border border-(--color-border-soft) bg-(--fcc-bg) flex flex-col transition-transform duration-[250ms] hover:-translate-y-[5px]"
    >
      <div className="w-14 h-14 rounded-[16px] flex items-center justify-center mb-[1.2rem] bg-(--fcc-icon-bg)">
        {icon}
      </div>

      <h3 className="font-display text-[1.1rem] font-extrabold mb-[0.6rem] text-(--fcc-font)">
        {title}
      </h3>

      <p className="flex-1 text-[0.91rem] leading-[1.65] text-(--fcc-font) opacity-75">
        {children}
      </p>

      <ul className="flex flex-col gap-2 mt-4">
        {checkItems.map((item, index) => (
          <li key={index} className="flex items-center gap-2 text-[0.85rem] text-(--fcc-font)">
            <Check
              size={14}
              strokeWidth={3}
              className="shrink-0 text-(--fcc-check)"
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
