import { normalizedRandom } from "@/lib/random/normalizedRandom";
import type { VocabularyLessonWord } from "./VocabularyLessonTypes";

export function selectVocabularyPracticeWord(
  words: readonly VocabularyLessonWord[],
  getPresentationCount: (wordId: string) => number,
  random: () => number
): VocabularyLessonWord {
  const maxShown = Math.max(
    ...words.map((word) => getPresentationCount(word.id))
  );
  const weighted = words.map((word) => ({
    word,
    weight: maxShown + 1 - getPresentationCount(word.id),
  }));
  const totalWeight = weighted.reduce(
    (total, candidate) => total + candidate.weight,
    0
  );
  let target = normalizedRandom(random()) * totalWeight;

  for (const candidate of weighted) {
    target -= candidate.weight;
    if (target < 0) {
      return candidate.word;
    }
  }

  return weighted[weighted.length - 1].word;
}
