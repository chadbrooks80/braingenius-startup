import React from "react";
import { getColorClass, type ColorToken } from "@/lib/theme-colors";

interface FeatureCardProps {
  icon: React.ReactNode;
  iconBgColor: ColorToken;
  title: string;
  borderColor: ColorToken;
  children: React.ReactNode;
}

export default function FeatureCard({
  icon,
  iconBgColor,
  title,
  borderColor,
  children,
}: FeatureCardProps) {
  return (
    <div
      className={`${getColorClass(borderColor, "border")} relative overflow-hidden cursor-default backdrop-blur-[12px] bg-(--color-surface) border border-(--color-border-soft) rounded-xl px-7 py-8 shadow-md transition-[transform,box-shadow,border-color] duration-300 ease-in-out hover:-translate-y-[6px] hover:shadow-[0_0_0_2px_var(--card-border),0_20px_60px_var(--card-glow)] hover:border-(--card-border) h-full`}
    >
      <div
        className={`w-[52px] h-[52px] rounded-[14px] mb-[1.1rem] flex items-center justify-center ${getColorClass(iconBgColor, "iconBg")}`}
      >
        {icon}
      </div>
      <h3 className="font-display text-[1.1rem] font-extrabold text-(--color-dark) mb-2">
        {title}
      </h3>
      <p className="text-[0.92rem] text-(--color-text-muted) leading-[1.65]">
        {children}
      </p>
    </div>
  );
}
