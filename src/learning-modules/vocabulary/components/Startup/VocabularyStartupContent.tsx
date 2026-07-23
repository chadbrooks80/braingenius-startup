import { BOOK_EMOJI, TARGET_EMOJI, TIMER_EMOJI } from "@/lib/emojis";

const EYEBROW = "TODAY'S VOCABULARY MISSION";
const TITLE = "5th Grade Core Words";
const DESCRIPTION =
  "Study 20 words in a focused lesson with five active words at a time.";

const STATS = [
  { icon: BOOK_EMOJI, value: "20", label: "Words" },
  { icon: TIMER_EMOJI, value: "5", label: "Active at Once" },
  { icon: TARGET_EMOJI, value: "Level 5", label: "Difficulty" },
];

const PATH_STEPS = ["Learn", "Choose", "Spell", "Master"];

type Stat = {
  icon: string;
  value: string;
  label: string;
};

export function VocabularyStartupContent() {
  return (
    <div className="flex flex-col gap-4">
      {/* Eyebrow */}
      <span className="text-xs font-bold tracking-widest uppercase text-secondary-strong">
        {EYEBROW}
      </span>

      {/* Title */}
      <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-heading">
        {TITLE}
      </h1>

      {/* Description */}
      <p className="text-sm font-medium leading-relaxed text-muted">
        {DESCRIPTION}
      </p>

      {/* Stats chips */}
      <div className="flex flex-wrap gap-2">
        {STATS.map((stat) => (
          <StatChip key={stat.label} stat={stat} />
        ))}
      </div>

      {/* Path card */}
      <div className="rounded-2xl px-4 py-3 border bg-secondary/13 border-secondary/34">
        <p className="text-[10px] font-bold tracking-widest uppercase mb-2 text-secondary-strong">
          YOUR PATH TODAY
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {PATH_STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-1.5">
              <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-surface/85 text-heading border-secondary/34">
                {step}
              </span>
              {i < PATH_STEPS.length - 1 && (
                <span className="text-xs font-bold text-secondary-strong">
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatChip({ stat }: { stat: Stat }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border bg-surface/85 border-heading/7 shadow-[0_1px_3px] shadow-heading/7">
      <span>{stat.icon}</span>
      <span className="font-bold text-heading">
        {stat.value}
      </span>
      <span className="text-muted">{stat.label}</span>
    </div>
  );
}

export default VocabularyStartupContent;
