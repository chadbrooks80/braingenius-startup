// Client-safe deterministic chunking for long public teaching passages. The
// provider request limit is a per-chunk boundary, not a maximum passage
// length: a long passage becomes multiple sequential provider-safe chunks
// split at natural paragraph, sentence, then whitespace boundaries. This
// module must stay free of server-only imports because the playback
// controller runs it in the browser.

/**
 * Documented per-provider-call input maximum, inclusive. The server route
 * independently validates the same boundary; client chunking is a
 * convenience, never an authorization or accounting decision.
 */
export const MAX_TTS_CHUNK_UTF8_BYTES = 5000;

/**
 * Thrown when a passage contains one uninterrupted token larger than the
 * provider chunk boundary. Callers fail the speech request safely instead of
 * cutting a word into corrupted speech.
 */
export class SpeechChunkingError extends Error {
  constructor() {
    super("Speech text contains an unsplittable token over the chunk limit.");
    this.name = "SpeechChunkingError";
  }
}

const encoder = new TextEncoder();

function utf8ByteLength(text: string): number {
  return encoder.encode(text).length;
}

function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/);
}

function splitIntoSentences(text: string): string[] {
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  return Array.from(segmenter.segment(text), (entry) => entry.segment);
}

function splitIntoWhitespaceTokens(text: string): string[] {
  return text.split(/\s+/);
}

/**
 * Greedily packs ordered units into chunks of at most maxBytes, recursing
 * into the next-finer boundary when one unit alone exceeds the limit.
 * Units are joined with a single space, which preserves word boundaries and
 * therefore the deterministic word count of the complete passage.
 */
function packUnits(
  units: readonly string[],
  maxBytes: number,
  packOversizedUnit: ((unit: string) => string[]) | null
): string[] {
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current !== "") {
      chunks.push(current);
      current = "";
    }
  };

  for (const rawUnit of units) {
    const unit = rawUnit.trim();
    if (unit === "") {
      continue;
    }

    if (utf8ByteLength(unit) > maxBytes) {
      if (!packOversizedUnit) {
        throw new SpeechChunkingError();
      }
      flush();
      chunks.push(...packOversizedUnit(unit));
      continue;
    }

    const candidate = current === "" ? unit : `${current} ${unit}`;
    if (utf8ByteLength(candidate) <= maxBytes) {
      current = candidate;
    } else {
      flush();
      current = unit;
    }
  }

  flush();
  return chunks;
}

/**
 * Splits one public teaching passage into ordered, non-blank chunks of at
 * most maxBytes UTF-8 bytes, preferring paragraph boundaries, then sentence
 * boundaries, then whitespace. Punctuation and word order are preserved;
 * normal words are never split. Throws SpeechChunkingError for a single
 * uninterrupted token over the limit.
 */
export function chunkSpeechText(
  text: string,
  maxBytes: number = MAX_TTS_CHUNK_UTF8_BYTES
): string[] {
  const trimmed = text.trim();
  if (trimmed === "") {
    return [];
  }
  if (utf8ByteLength(trimmed) <= maxBytes) {
    return [trimmed];
  }

  return packUnits(splitIntoParagraphs(trimmed), maxBytes, (paragraph) =>
    packUnits(splitIntoSentences(paragraph), maxBytes, (sentence) =>
      packUnits(splitIntoWhitespaceTokens(sentence), maxBytes, null)
    )
  );
}
