import { OPEN_BOOK_EMOJI } from "@/lib/emojis";

type WordChip = {
  word: string;
  className: string;
};

// Each chip's position and rotation is baked into a complete literal class
// string (rather than composed from a shared position object) so Tailwind
// can statically discover every class during the build.
const WORD_CHIPS: WordChip[] = [
  {
    word: "curious",
    className:
      "absolute top-[12%] left-[8%] -rotate-[6deg] px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-surface/(--alpha-surface-strong) text-heading shadow-[0_2px_8px] shadow-heading/(--alpha-subtle) backdrop-blur-[4px]",
  },
  {
    word: "imagine",
    className:
      "absolute top-[16%] right-[10%] rotate-[5deg] px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-surface/(--alpha-surface-strong) text-heading shadow-[0_2px_8px] shadow-heading/(--alpha-subtle) backdrop-blur-[4px]",
  },
  {
    word: "discover",
    className:
      "absolute bottom-[24%] left-[6%] rotate-[4deg] px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-surface/(--alpha-surface-strong) text-heading shadow-[0_2px_8px] shadow-heading/(--alpha-subtle) backdrop-blur-[4px]",
  },
  {
    word: "master",
    className:
      "absolute bottom-[14%] right-[8%] -rotate-[4deg] px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-surface/(--alpha-surface-strong) text-heading shadow-[0_2px_8px] shadow-heading/(--alpha-subtle) backdrop-blur-[4px]",
  },
];

export function VocabularyStartupVisual() {
  return (
    <div className="relative overflow-hidden h-full min-h-[280px] bg-linear-135/srgb from-primary/(--alpha-subtle) to-secondary/(--alpha-subtle)">
      {/* Decorative circles */}
      <div className="absolute rounded-full bg-primary/(--alpha-soft) w-[200px] h-[200px] -top-[60px] -right-[60px]" />
      <div className="absolute rounded-full bg-secondary/(--alpha-soft) w-[140px] h-[140px] -bottom-[40px] -left-[30px]" />

      {/* Center book stage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center justify-center rounded-3xl bg-surface/(--alpha-surface-strong) shadow-[0_8px_32px] shadow-heading/(--alpha-subtle) w-[120px] h-[120px] backdrop-blur-[8px]">
          <span className="text-[60px] leading-none" role="img" aria-label="book">
            {OPEN_BOOK_EMOJI}
          </span>
        </div>
      </div>

      {/* Floating word chips */}
      {WORD_CHIPS.map(({ word, className }) => (
        <div key={word} className={className}>
          {word}
        </div>
      ))}
    </div>
  );
}

export default VocabularyStartupVisual;
