import { ReactNode } from "react";

interface EyebrowProps {
  bgColor?: string;
  textColor?: string;
  children: ReactNode;
}

export default function Eyebrow({
  bgColor = "--color-primary-cyan",
  textColor = "--color-text-primary",
  children,
}: EyebrowProps) {
  return (
    <span
      style={{
        "--eyebrow-bg": `var(${bgColor})`,
        "--eyebrow-color": `var(${textColor})`,
      } as React.CSSProperties}
      className="inline-flex items-center gap-2 px-[0.85rem] py-[0.35rem] rounded-(--radius-full) border text-[0.75rem] font-bold tracking-[0.15em] uppercase bg-(--eyebrow-bg)/15 text-(--eyebrow-color) border-(--eyebrow-color)/40"
    >
      {children}
    </span>
  );
}
