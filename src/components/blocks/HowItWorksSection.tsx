import Eyebrow from "@/components/ui/Eyebrow";
import ExampleBlock from "@/components/blocks/ExampleBlock";
import CheckBadge from "@/components/ui/CheckBadge";
import { Zap } from "lucide-react";

const CHECK_ITEMS = [
  "Never too easy",
  "Never too hard",
  "Spaced reviews",
  "Mastery-based",
  "Works offline",
  "Grade-aligned",
];

const PROGRESS_BARS = [
  {
    label: "Word Mastery",
    value: 84,
    gradient: "linear-gradient(90deg, var(--color-primary-cyan), var(--color-cyan-light))",
    delay: "0s",
  },
  {
    label: "Retention Rate",
    value: 91,
    gradient: "linear-gradient(90deg, var(--color-secondary-lime), var(--color-secondary-lime))",
    delay: "0.15s",
  },
  {
    label: "Session Consistency",
    value: 76,
    gradient: "linear-gradient(90deg, var(--color-accent-indigo), var(--color-accent-indigo))",
    delay: "0.3s",
  },
];

const STATS = [
  { value: "142", label: "Words mastered", color: "--color-primary-cyan" },
  { value: "12", label: "Day streak", color: "--color-secondary-lime" },
  { value: "23min", label: "Avg. session", color: "--color-accent-indigo" },
  { value: "4.8★", label: "Student rating", color: "--color-accent-pink" },
];

export default function HowItWorksSection() {
  return (
    <section className="py-(--spacing-section) px-(--spacing-container)">
      <div className="grid lg:grid-cols-2 gap-14 items-center max-w-(--max-width-container) mx-auto w-full">

        {/* Mobile order 1 | Desktop: col 2, row 1 */}
        <div className="lg:col-start-2 lg:row-start-1">
          <Eyebrow>
            <Zap className="w-3 h-3" />
            How It Works
          </Eyebrow>
        </div>

        {/* Mobile order 2 | Desktop: col 2, row 2 */}
        <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-black leading-tight tracking-[-0.03em] text-(--color-text-primary) lg:col-start-2 lg:row-start-2">
          Personalized learning that never plateaus
        </h2>

        {/* Mobile order 3 | Desktop: col 1, rows 1–4 */}
        <div className="lg:col-start-1 lg:row-start-1 lg:row-span-4 animate-[bob_6s_ease-in-out_infinite]">
          <ExampleBlock label="Student Progress" status="This Week" statusColor="--color-secondary-lime">
            <div className="space-y-4 mb-6">
              {PROGRESS_BARS.map(({ label, value, gradient, delay }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-(--font-size-label) text-(--color-text-light)">{label}</span>
                    <span className="text-(--font-size-label) font-semibold text-(--color-text-inverse)">{value}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-white/10">
                    <div
                      className="h-full rounded-full origin-left animate-[progressFill_1.5s_ease-out_both]"
                      style={{ width: `${value}%`, background: gradient, animationDelay: delay }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {STATS.map(({ value, label, color }) => (
                <div key={label} className="rounded-(--radius-xl) p-3 bg-white/5">
                  <div className="font-display text-2xl font-black" style={{ color: `var(${color})` }}>
                    {value}
                  </div>
                  <div className="text-(--font-size-label) text-(--color-text-muted) mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </ExampleBlock>
        </div>

        {/* Mobile order 4 | Desktop: col 2, row 3 */}
        <p className="text-[1.1rem] leading-[1.75] text-(--color-text-muted) lg:col-start-2 lg:row-start-3">
          The engine tracks every answer, every hesitation, every review. It builds a mastery profile per word and uses that to schedule the perfect next session — keeping students challenged but never lost.
        </p>

        {/* Mobile order 5 | Desktop: col 2, row 4 */}
        <div className="flex flex-wrap gap-2.5 lg:col-start-2 lg:row-start-4">
          {CHECK_ITEMS.map((item) => (
            <CheckBadge key={item} label={item} />
          ))}
        </div>

      </div>
    </section>
  );
}
