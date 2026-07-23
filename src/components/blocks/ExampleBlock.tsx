import { ReactNode } from "react";
import { getColorClass, type ColorToken } from "@/lib/theme-colors";

interface ExampleBlockProps {
  label: string;
  status?: string;
  statusColor?: ColorToken;
  children: ReactNode;
}

export default function ExampleBlock({
  label,
  status,
  statusColor = "secondary",
  children,
}: ExampleBlockProps) {
  return (
    <section
      className="bg-heading rounded-(--radius-3xl) p-(--spacing-card-pad) shadow-(--shadow-xl) text-surface"
    >
      <header className="flex items-center justify-between mb-4">
        <span className="text-label font-semibold text-surface/(--alpha-surface-soft) uppercase tracking-(--tracking-label)">
          {label}
        </span>

        {status && (
          <span
            className={`${getColorClass(statusColor, "bg")} text-heading text-badge font-extrabold tracking-(--tracking-badge) uppercase px-(--spacing-badge-x) py-(--spacing-badge-y) rounded-(--radius-full)`}
          >
            {status}
          </span>
        )}
      </header>

      <div>{children}</div>
    </section>
  );
}
