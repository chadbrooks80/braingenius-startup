import type { Dispatch, SetStateAction } from "react";

export type VocabularyPanelDisplayWord = {
  id: string;
  word: string;
};

export type VocabularyPanelSpellingWord = {
  id: string;
};

export type VocabularyStatusPanelSetters = {
  setWordList: Dispatch<SetStateAction<VocabularyPanelDisplayWord[]>>;
  setSpellingWords: Dispatch<SetStateAction<VocabularyPanelSpellingWord[]>>;
  setMasteredWords: Dispatch<SetStateAction<VocabularyPanelDisplayWord[]>>;
};

export function createVocabularyStatusPanelSetters(
  setWordList: VocabularyStatusPanelSetters["setWordList"],
  setSpellingWords: VocabularyStatusPanelSetters["setSpellingWords"],
  setMasteredWords: VocabularyStatusPanelSetters["setMasteredWords"]
): VocabularyStatusPanelSetters {
  return { setWordList, setSpellingWords, setMasteredWords };
}
