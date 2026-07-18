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
    "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 select-none disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none";

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--navy)",
      boxShadow: "0 2px 8px var(--shadow-button)",
    },
    secondary: {
      background: "var(--tint-lime)",
      color: "var(--lime-ink)",
      border: "1px solid var(--border-lime)",
    },
    ghost: {
      background: "transparent",
      color: "var(--muted)",
    },
    accent: {
      background: "linear-gradient(135deg, var(--cyan), var(--sky))",
      color: "var(--navy)",
      boxShadow: "0 8px 24px var(--shadow-cyan)",
    },
  };

  const variantClass =
    variant === "primary"
      ? "text-white hover:-translate-y-0.5 hover:shadow-[0_6px_18px_var(--shadow-button-hover)]"
      : "hover:-translate-y-0.5 hover:shadow-sm";

  return (
    <button
      type="button"
      className={`${base} ${variantClass}`}
      style={variantStyles[variant]}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
      {trailingIcon && <span aria-hidden="true">{trailingIcon}</span>}
      {helperText && (
        <span className="text-xs opacity-70 ml-1">{helperText}</span>
      )}
    </button>
  );
}

export default Button;
