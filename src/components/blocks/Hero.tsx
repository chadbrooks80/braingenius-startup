import Eyebrow from "@/components/ui/Eyebrow";
import ExampleBlock from "@/components/blocks/ExampleBlock";
import { Rocket, PlayCircle, Check, Flame } from "lucide-react";

export default function Hero() {
  return (
    <section className="py-(--spacing-section) px-(--spacing-container) relative isolate lg:min-h-[calc(100dvh-var(--header-height))] lg:flex lg:items-center">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center max-w-(--max-width-container) mx-auto w-full">

        <div className="lg:col-start-1 lg:row-start-1">
          <Eyebrow>
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            AI-Powered Vocabulary Learning
          </Eyebrow>
        </div>

        <h1 className="font-display text-[clamp(2.6rem,5vw,3.8rem)] font-black leading-[1.08] tracking-[-0.03em] text-text lg:col-start-1 lg:row-start-2">
          The vocabulary app that{" "}
          <span className="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
            adapts to every student.
          </span>
        </h1>

        {/* ExampleBlock stays visible at all screen sizes — never hidden */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-4 animate-[bob_6s_ease-in-out_infinite]">
          <ExampleBlock label="Adaptive Session" status="Live">
            <div className="rounded-(--radius-2xl) p-5 mb-4 bg-gradient-to-br from-primary via-primary to-feature text-heading">
              <p className="text-(--font-size-badge) font-bold uppercase tracking-(--tracking-badge) text-heading/(--alpha-surface-soft) mb-1">
                What does this word mean?
              </p>
              <p className="font-display text-[2rem] font-black">Tenacious</p>
              <p className="text-[0.85rem] mt-1 text-heading/(--alpha-surface)">
                Grade 7 · Vocabulary · Word 4 of 10
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2 bg-secondary/(--alpha-soft) border border-secondary rounded-(--radius-xl) px-4 py-3 text-sm font-medium text-secondary">
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
                  className="bg-surface/(--alpha-hairline) border border-surface/(--alpha-subtle) rounded-(--radius-xl) px-4 py-3 text-sm font-medium text-surface/(--alpha-surface)"
                >
                  {choice}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="flex items-center gap-1.5 text-sm text-surface/(--alpha-surface-soft)">
                <Flame className="w-4 h-4 text-energy" />
                7-day streak
              </span>
              <span className="bg-secondary/(--alpha-subtle) text-secondary text-(--font-size-badge) font-bold px-(--spacing-badge-x) py-(--spacing-badge-y) rounded-(--radius-full)">
                +15 XP earned
              </span>
            </div>
          </ExampleBlock>
        </div>

        <p className="text-[1.1rem] leading-[1.75] text-muted max-w-[38rem] lg:col-start-1 lg:row-start-3">
          BrainGenius.ai combines adaptive learning with spaced repetition so
          every session feels just right — never too easy, never overwhelming.
          Students stay in the zone and actually retain what they learn.
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap items-start gap-3 lg:col-start-1 lg:row-start-4">
          <a
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-gradient-to-br from-primary to-primary text-heading font-display text-base font-extrabold px-8 py-3.5 rounded-(--radius-full) shadow-[0_8px_32px] shadow-primary/(--alpha-medium) transition-transform duration-200 hover:-translate-y-[3px]"
          >
            <Rocket className="w-4 h-4" />
            Get Started For Free!
          </a>
          <a
            href="#features"
            className="inline-flex items-center gap-2 bg-transparent border-2 border-heading/(--alpha-soft) text-text px-6 py-3 rounded-(--radius-full) text-[0.95rem] font-semibold transition-all duration-200 hover:border-primary hover:bg-primary/(--alpha-hairline)"
          >
            <PlayCircle className="w-4 h-4" />
            See How It Works
          </a>

          <p className="w-full text-(--font-size-badge) text-muted flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary" />
              No credit card required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary" />
              Free for teachers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary" />
              Set up in 2 minutes
            </span>
          </p>
        </div>

      </div>
    </section>
  );
}
