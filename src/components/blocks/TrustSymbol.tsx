import React from "react";
import { getColorClass, type ColorToken } from "@/lib/theme-colors";

type TrustSymbolProps = {
  iconOrImage: React.ReactNode;
  iconBgColor?: ColorToken;
  title: string;
  subtitle: string;
};

export default function TrustSymbol({
  iconOrImage,
  iconBgColor,
  title,
  subtitle,
}: TrustSymbolProps) {
  return (
    <div className="flex items-center gap-3 bg-surface/(--alpha-surface) border border-surface/(--alpha-surface-soft) rounded-full px-6 py-3 shadow-(--shadow-md) transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-lg)">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[1.1rem] overflow-hidden ${
          iconBgColor ? getColorClass(iconBgColor, "iconBg") : ""
        }`}
      >
        {iconOrImage}
      </div>
      <div>
        <strong className="block text-[0.88rem] font-bold text-heading">
          {title}
        </strong>
        <span className="text-[0.75rem] text-muted">
          {subtitle}
        </span>
      </div>
    </div>
  );
}
