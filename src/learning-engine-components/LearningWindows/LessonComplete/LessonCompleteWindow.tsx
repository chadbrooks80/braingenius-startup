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
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="w-full max-w-lg rounded-3xl p-8 border border-surface/(--alpha-surface) bg-surface/(--alpha-surface-strong) shadow-[0_16px_56px] shadow-heading/(--alpha-subtle)"
      >
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
      </div>
    </div>
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
