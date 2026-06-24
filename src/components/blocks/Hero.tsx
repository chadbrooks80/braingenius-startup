import Eyebrow from "@/components/ui/Eyebrow";
import ExampleBlock from "@/components/blocks/ExampleBlock";
import { Rocket, PlayCircle, Check, Flame } from "lucide-react";

export default function Hero() {
  return (
    <section className="py-(--spacing-section) px-(--spacing-container) relative isolate lg:min-h-[calc(100dvh-var(--header-height))] lg:flex lg:items-center">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center max-w-(--max-width-container) mx-auto w-full">

        <div className="lg:col-start-1 lg:row-start-1">
          <Eyebrow>
            <span className="w-1.5 h-1.5 rounded-full bg-(--color-primary-cyan) animate-pulse inline-block" />
            AI-Powered Vocabulary Learning
          </Eyebrow>
        </div>

        <h1 className="font-display text-[clamp(2.6rem,5vw,3.8rem)] font-black leading-[1.08] tracking-[-0.03em] text-(--color-text-primary) lg:col-start-1 lg:row-start-2">
          The vocabulary app that{" "}
          <span className="bg-gradient-to-br from-(--color-primary-cyan) to-(--color-secondary-lime) bg-clip-text text-transparent">
            adapts to every student.
          </span>
        </h1>

        {/* ExampleBlock stays visible at all screen sizes — never hidden */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-4 animate-[bob_6s_ease-in-out_infinite]">
          <ExampleBlock label="Adaptive Session" status="Live">
            <div className="rounded-(--radius-2xl) p-5 mb-4 bg-gradient-to-br from-(--color-primary-cyan) via-(--color-cyan-light) to-(--color-accent-indigo) text-(--color-dark)">
              <p className="text-(--font-size-badge) font-bold uppercase tracking-(--tracking-badge) text-(--color-dark)/60 mb-1">
                What does this word mean?
              </p>
              <p className="font-display text-[2rem] font-black">Tenacious</p>
              <p className="text-[0.85rem] mt-1 text-(--color-dark)/75">
                Grade 7 · Vocabulary · Word 4 of 10
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2 bg-(--color-secondary-lime)/20 border border-(--color-secondary-lime) rounded-(--radius-xl) px-4 py-3 text-sm font-medium text-(--color-secondary-lime)">
                <Check className="w-4 h-4 shrink-0" />
                Persistent; not giving up easily
              </div>
              {[
                "Easily frightened or startled",
                "Willing to take bold risks",
                "Overly confident without cause",
              ].map((choice) => (
                <div
                  key={choice}
                  className="bg-white/[0.07] border border-white/[0.12] rounded-(--radius-xl) px-4 py-3 text-sm font-medium text-(--color-text-inverse)"
                >
                  {choice}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="flex items-center gap-1.5 text-sm text-(--color-text-light)">
                <Flame className="w-4 h-4 text-(--color-accent-orange)" />
                7-day streak
              </span>
              <span className="bg-(--color-secondary-lime)/15 text-(--color-secondary-lime) text-(--font-size-badge) font-bold px-(--spacing-badge-x) py-(--spacing-badge-y) rounded-(--radius-full)">
                +15 XP earned
              </span>
            </div>
          </ExampleBlock>
        </div>

        <p className="text-[1.1rem] leading-[1.75] text-(--color-text-muted) max-w-[38rem] lg:col-start-1 lg:row-start-3">
          BrainGenius.ai combines adaptive learning with spaced repetition so
          every session feels just right — never too easy, never overwhelming.
          Students stay in the zone and actually retain what they learn.
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap items-start gap-3 lg:col-start-1 lg:row-start-4">
          <a
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-gradient-to-br from-(--color-primary-cyan) to-(--color-cyan-light) text-(--color-dark) font-display text-base font-extrabold px-8 py-3.5 rounded-(--radius-full) shadow-(--shadow-glow-cyan) transition-transform duration-200 hover:-translate-y-[3px]"
          >
            <Rocket className="w-4 h-4" />
            Get Started For Free!
          </a>
          <a
            href="#features"
            className="inline-flex items-center gap-2 bg-transparent border-2 border-(--color-border-muted) text-(--color-text-primary) px-6 py-3 rounded-(--radius-full) text-[0.95rem] font-semibold transition-all duration-200 hover:border-(--color-primary-cyan) hover:bg-(--color-primary-cyan)/[0.07]"
          >
            <PlayCircle className="w-4 h-4" />
            See How It Works
          </a>

          <p className="w-full text-(--font-size-badge) text-(--color-text-muted) flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-(--color-primary-cyan)" />
              No credit card required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-(--color-primary-cyan)" />
              Free for teachers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-(--color-primary-cyan)" />
              Set up in 2 minutes
            </span>
          </p>
        </div>

      </div>
    </section>
  );
}
