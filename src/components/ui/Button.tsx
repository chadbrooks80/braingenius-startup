import { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

export type ButtonVariant =
  | "cta"
  | "primary"
  | "secondary"
  | "oauth"
  | "learning-primary"
  | "learning-secondary"
  | "learning-ghost"
  | "learning-accent";
export type ButtonSize = "default" | "sm";

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
  trailingIcon?: ReactNode;
  helperText?: ReactNode;
};

type AsAnchor = ButtonBaseProps & { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>;
type AsButton = ButtonBaseProps & { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>;
type ButtonProps = AsAnchor | AsButton;

const ctaSizes: Record<ButtonSize, string> = {
  default: "px-[clamp(0.7rem,2vw,1.4rem)] py-[clamp(0.28rem,1.2vw,0.6rem)] text-[clamp(0.55rem,1.5vw,0.9rem)]",
  sm: "px-[clamp(0.55rem,3vw,1.19rem)] py-[clamp(0.28rem,1.5vw,0.51rem)] text-[clamp(0.55rem,2.5vw,0.765rem)]",
};

/* Truly common to every variant; per-variant recipes below stay full literals. */
const sharedBase =
  "cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-(--alpha-surface-soft) disabled:transform-none";

const variants: Record<ButtonVariant, string> = {
  cta: clsx(
    "inline-flex items-center gap-2 no-underline",
    "bg-heading text-surface",
    "rounded-(--radius-full) font-semibold border-none",
    "duration-(--transition-fast)",
    "hover:bg-primary-strong hover:-translate-y-0.5"
  ),
  primary: clsx(
    "inline-flex items-center gap-2 no-underline",
    "bg-linear-to-br from-primary to-primary",
    "text-heading font-display text-[1rem] font-extrabold",
    "px-8 py-[0.85rem] rounded-(--radius-full) border-none",
    "shadow-[0_8px_32px] shadow-primary/(--alpha-medium)",
    "duration-(--transition-normal)",
    "hover:-translate-y-1 hover:shadow-[0_12px_40px] hover:shadow-primary/(--alpha-medium)"
  ),
  secondary: clsx(
    "inline-flex items-center gap-2 no-underline",
    "bg-transparent border-2 border-heading/(--alpha-soft)",
    "text-text px-6 py-[0.82rem] rounded-(--radius-full)",
    "text-[0.95rem] font-semibold",
    "duration-(--transition-fast)",
    "hover:border-primary hover:bg-primary/(--alpha-hairline)"
  ),
  oauth: clsx(
    "inline-flex items-center gap-2 no-underline",
    "bg-surface border-2 border-heading/(--alpha-soft)",
    "text-text px-6 py-[0.82rem] rounded-(--radius-full)",
    "text-[0.95rem] font-semibold",
    "duration-(--transition-fast)",
    "hover:border-primary hover:bg-primary/(--alpha-hairline)"
  ),
  "learning-primary": clsx(
    "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold duration-150 select-none",
    "bg-heading text-surface shadow-[0_2px_8px] shadow-heading/(--alpha-soft) hover:-translate-y-0.5 hover:shadow-[0_6px_18px]"
  ),
  "learning-secondary": clsx(
    "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold duration-150 select-none",
    "bg-secondary/(--alpha-subtle) text-secondary-strong border border-secondary/(--alpha-medium) hover:-translate-y-0.5 hover:shadow-sm"
  ),
  "learning-ghost": clsx(
    "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold duration-150 select-none",
    "bg-transparent text-muted hover:-translate-y-0.5 hover:shadow-sm"
  ),
  "learning-accent": clsx(
    "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold duration-150 select-none",
    "text-heading shadow-[0_8px_24px] shadow-primary/(--alpha-medium) hover:-translate-y-0.5 hover:shadow-sm bg-linear-[135deg] from-primary to-primary"
  ),
};

export default function Button({
  variant = "cta",
  size = "default",
  href,
  className,
  children,
  trailingIcon,
  helperText,
  ...props
}: ButtonProps) {
  const sizeClass = variant === "cta" ? ctaSizes[size] : "";
  const classes = clsx(sharedBase, variants[variant], sizeClass, className);

  const content = (
    <>
      {children}
      {trailingIcon && <span aria-hidden="true">{trailingIcon}</span>}
      {helperText && (
        <span className="text-xs opacity-(--alpha-surface) ml-1">{helperText}</span>
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    );
  }

  const { type = "button", ...buttonProps } = props as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button type={type} className={classes} {...buttonProps}>
      {content}
    </button>
  );
}
