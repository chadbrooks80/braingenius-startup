import { ReactNode } from "react";

interface ExampleBlockProps {
  label: string;
  status?: string;
  statusColor?: string;
  children: ReactNode;
}

interface BadgeStyle extends React.CSSProperties {
  "--badge-bg": string;
}

export default function ExampleBlock({
  label,
  status,
  statusColor = "--color-secondary-lime",
  children,
}: ExampleBlockProps) {
  return (
    <section
      className="bg-(--color-dark) rounded-(--radius-3xl) p-(--spacing-card-pad) shadow-(--shadow-xl) text-(--color-white)"
    >
      <header className="flex items-center justify-between mb-4">
        <span className="text-(--font-size-label) font-semibold text-(--color-text-light) uppercase tracking-(--tracking-label)">
          {label}
        </span>

        {status && (
          <span
            style={{ "--badge-bg": `var(${statusColor})` } as BadgeStyle}
            className="bg-(--badge-bg) text-(--color-dark) text-(--font-size-badge) font-extrabold tracking-(--tracking-badge) uppercase px-(--spacing-badge-x) py-(--spacing-badge-y) rounded-(--radius-full)"
          >
            {status}
          </span>
        )}
      </header>

      <div>{children}</div>
    </section>
  );
}
