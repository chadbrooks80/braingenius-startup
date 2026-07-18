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
      className="relative overflow-hidden h-full"
      style={{
        background: "linear-gradient(135deg, var(--tint-cyan) 0%, var(--tint-lime) 100%)",
        minHeight: 280,
      }}
    >
      {/* Decorative circles */}
      <div
        className="absolute rounded-full"
        style={{
          width: 200,
          height: 200,
          top: -60,
          right: -60,
          background: "var(--tint-cyan-strong)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 140,
          height: 140,
          bottom: -40,
          left: -30,
          background: "var(--tint-lime-strong)",
        }}
      />

      {/* Center book stage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center rounded-3xl"
          style={{
            width: 120,
            height: 120,
            background: "var(--surface-strong)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 8px 32px var(--shadow-strong)",
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
            className="absolute px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
            style={{
              ...position,
              background: "var(--surface-translucent)",
              backdropFilter: "blur(4px)",
              color: "var(--navy)",
              boxShadow: "0 2px 8px var(--shadow-medium)",
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
