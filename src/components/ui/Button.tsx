import { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

type ButtonVariant = "cta" | "primary" | "secondary";
type ButtonSize = "default" | "sm";

type AsAnchor = { variant?: ButtonVariant; size?: ButtonSize; href: string; className?: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>;
type AsButton = { variant?: ButtonVariant; size?: ButtonSize; href?: undefined; className?: string; children?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>;
type ButtonProps = AsAnchor | AsButton;

const ctaSizes: Record<ButtonSize, string> = {
  default: "px-[clamp(0.7rem,2vw,1.4rem)] py-[clamp(0.28rem,1.2vw,0.6rem)] text-[clamp(0.55rem,1.5vw,0.9rem)]",
  sm: "px-[clamp(0.55rem,3vw,1.19rem)] py-[clamp(0.28rem,1.5vw,0.51rem)] text-[clamp(0.55rem,2.5vw,0.765rem)]",
};

export default function Button({
  variant = "cta",
  size = "default",
  href,
  className,
  children,
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center gap-2 cursor-pointer transition-all no-underline";

  const variants: Record<ButtonVariant, string> = {
    cta: clsx(
      "bg-heading text-surface",
      "rounded-(--radius-full) font-semibold border-none",
      "duration-(--transition-fast)",
      "hover:bg-primary-strong hover:-translate-y-0.5"
    ),
    primary: clsx(
      "bg-linear-to-br from-primary to-primary",
      "text-heading font-display text-[1rem] font-extrabold",
      "px-8 py-[0.85rem] rounded-(--radius-full) border-none",
      "shadow-[0_8px_32px] shadow-primary/34",
      "duration-(--transition-normal)",
      "hover:-translate-y-1 hover:shadow-[0_12px_40px] hover:shadow-primary/34"
    ),
    secondary: clsx(
      "bg-transparent border-2 border-heading/20",
      "text-text px-6 py-[0.82rem] rounded-(--radius-full)",
      "text-[0.95rem] font-semibold",
      "duration-(--transition-fast)",
      "hover:border-primary hover:bg-primary/7"
    ),
  };

  const sizeClass = variant === "cta" ? ctaSizes[size] : "";
  const classes = clsx(base, variants[variant], sizeClass, className);

  if (href) {
    return (
      <a href={href} className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
