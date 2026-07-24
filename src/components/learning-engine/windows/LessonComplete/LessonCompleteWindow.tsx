import { LearningWindowShell } from "@/components/learning-engine/LearningWindowShell";

export type LessonCompleteWindowProps = {
  title: string;
  message: string;
  stats: Array<{ label: string; value: string | number }>;
};

export function LessonCompleteWindow({
  title,
  message,
  stats,
}: LessonCompleteWindowProps) {
  return (
    <LearningWindowShell backdrop={false}>
      <h1 className="font-display text-4xl font-extrabold mb-3 text-heading">
        {title}
      </h1>
      <p className="mb-6 leading-relaxed text-muted">
        {message}
      </p>
      <dl className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <Stat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </dl>
    </LearningWindowShell>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl px-3 py-4 text-center border bg-primary/(--alpha-subtle) border-primary/(--alpha-medium)">
      <dt className="text-xs font-semibold text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-extrabold text-heading">
        {value}
      </dd>
    </div>
  );
}

export default LessonCompleteWindow;
