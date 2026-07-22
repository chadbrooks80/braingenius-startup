import { OPEN_BOOK_EMOJI } from "@/lib/emojis";

const WORDS = ["curious", "imagine", "discover", "master"];

type WordPosition = {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  rotation: string;
};

const WORD_POSITIONS: WordPosition[] = [
  { top: "12%", left: "8%", rotation: "-6deg" },
  { top: "16%", right: "10%", rotation: "5deg" },
  { bottom: "24%", left: "6%", rotation: "4deg" },
  { bottom: "14%", right: "8%", rotation: "-4deg" },
];

export function VocabularyStartupVisual() {
  return (
    <div
      className="relative overflow-hidden h-full bg-linear-135/srgb from-cyan/13 to-lime/13"
      style={{ minHeight: 280 }}
    >
      {/* Decorative circles */}
      <div
        className="absolute rounded-full bg-cyan/20"
        style={{
          width: 200,
          height: 200,
          top: -60,
          right: -60,
        }}
      />
      <div
        className="absolute rounded-full bg-lime/20"
        style={{
          width: 140,
          height: 140,
          bottom: -40,
          left: -30,
        }}
      />

      {/* Center book stage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center rounded-3xl bg-white/85 shadow-[0_8px_32px] shadow-navy/13"
          style={{
            width: 120,
            height: 120,
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ fontSize: 60, lineHeight: 1 }} role="img" aria-label="book">
            {OPEN_BOOK_EMOJI}
          </span>
        </div>
      </div>

      {/* Floating word chips */}
      {WORDS.slice(0, WORD_POSITIONS.length).map((word, i) => {
        const { rotation, ...position } = WORD_POSITIONS[i];
        return (
          <div
            key={word}
            className="absolute px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-white/85 text-navy shadow-[0_2px_8px] shadow-navy/13"
            style={{
              ...position,
              backdropFilter: "blur(4px)",
              transform: `rotate(${rotation})`,
            }}
          >
            {word}
          </div>
        );
      })}
    </div>
  );
}

export default VocabularyStartupVisual;
