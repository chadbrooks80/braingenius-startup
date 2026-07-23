"use client";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent";

export type ButtonProps = {
  label: string;
  variant: ButtonVariant;
  trailingIcon?: string;
  helperText?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function Button({
  label,
  variant,
  trailingIcon,
  helperText,
  onClick,
  disabled = false,
}: ButtonProps) {
  const base =
    "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 select-none disabled:cursor-not-allowed disabled:opacity-(--alpha-surface-soft) disabled:transform-none";

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      "bg-heading text-surface shadow-[0_2px_8px] shadow-heading/(--alpha-soft) hover:-translate-y-0.5 hover:shadow-[0_6px_18px]",
    secondary:
      "bg-secondary/(--alpha-subtle) text-secondary-strong border border-secondary/(--alpha-medium) hover:-translate-y-0.5 hover:shadow-sm",
    ghost: "bg-transparent text-muted hover:-translate-y-0.5 hover:shadow-sm",
    accent:
      "text-heading shadow-[0_8px_24px] shadow-primary/(--alpha-medium) hover:-translate-y-0.5 hover:shadow-sm bg-linear-[135deg] from-primary to-primary",
  };

  return (
    <button
      type="button"
      className={`${base} ${variantClasses[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
      {trailingIcon && <span aria-hidden="true">{trailingIcon}</span>}
      {helperText && (
        <span className="text-xs opacity-(--alpha-surface) ml-1">{helperText}</span>
      )}
    </button>
  );
}

export default Button;
