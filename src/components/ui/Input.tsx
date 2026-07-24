import { forwardRef, InputHTMLAttributes } from "react";
import { clsx } from "clsx";

export type InputVariant = "default" | "code" | "learning-answer";

export type InputProps = {
  variant?: InputVariant;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>;

const variantClasses: Record<InputVariant, string> = {
  default:
    "w-full rounded-(--radius-lg) border-2 border-heading/(--alpha-soft) bg-surface px-4 py-2.5 text-sm text-text outline-none transition-all duration-(--transition-fast) focus:border-focus focus-visible:ring-2 focus-visible:ring-focus/(--alpha-medium)",
  code: "w-full rounded-(--radius-lg) border-2 border-heading/(--alpha-soft) bg-surface px-4 py-2.5 text-center text-lg tracking-(--tracking-label) text-text outline-none transition-all duration-(--transition-fast) focus:border-focus focus-visible:ring-2 focus-visible:ring-focus/(--alpha-medium)",
  "learning-answer":
    "min-w-0 flex-1 rounded-xl border px-4 py-3 text-base outline-none disabled:opacity-(--alpha-surface) border-heading/(--alpha-subtle) bg-surface text-text transition-colors focus:border-focus focus-visible:ring-2 focus-visible:ring-focus/(--alpha-medium)",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = "default", className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(variantClasses[variant], className)}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export default Input;
