export type VocabularyChoice = {
  id: string;
  text: string;
};

export const VOCABULARY_SCREEN_CONTENT_TYPES = [
  "definition-display",
  "definition-fun-fact",
  "definition-practice",
  "spelling-practice",
  "answer-recap",
  "word-search-checkpoint",
] as const;

// The number of unique first-mastered words grouped into each ungraded Word
// Search checkpoint. Shared by lesson progression (state) and the checkpoint
// content projection (data) so both stay anchored to one source of truth.
export const WORD_SEARCH_CHECKPOINT_GROUP_SIZE = 5;

export type VocabularyScreenContentType =
  (typeof VOCABULARY_SCREEN_CONTENT_TYPES)[number];

export type VocabularyLessonManifestRequest = {
  contentType: "manifest";
  wordListId: string;
};

// Authorized refill loading: retrieves exactly one next ordered database
// word after one confirmed initial mastery opens one active-pool slot. The
// browser supplies only the opaque lessonId; the server derives the single
// valid next position from server-authoritative lesson state.
export type VocabularyWordRefillRequest = {
  contentType: "word-refill";
  lessonId: string;
};

type VocabularyScreenContentRequest = {
  lessonId: string;
  capability: string;
};

export type VocabularyDefinitionDisplayRequest = VocabularyScreenContentRequest & {
  contentType: "definition-display";
};

export type VocabularyDefinitionFunFactRequest = VocabularyScreenContentRequest & {
  contentType: "definition-fun-fact";
};

export type VocabularyDefinitionPracticeRequest = VocabularyScreenContentRequest & {
  contentType: "definition-practice";
};

export type VocabularySpellingPracticeRequest = VocabularyScreenContentRequest & {
  contentType: "spelling-practice";
};

export type VocabularyAnswerRecapRequest = VocabularyScreenContentRequest & {
  contentType: "answer-recap";
  exampleIndex: number;
};

export type VocabularyWordSearchCheckpointRequest = VocabularyScreenContentRequest & {
  contentType: "word-search-checkpoint";
};

export type VocabularyContentRequest =
  | VocabularyLessonManifestRequest
  | VocabularyWordRefillRequest
  | VocabularyDefinitionDisplayRequest
  | VocabularyDefinitionFunFactRequest
  | VocabularyDefinitionPracticeRequest
  | VocabularySpellingPracticeRequest
  | VocabularyAnswerRecapRequest
  | VocabularyWordSearchCheckpointRequest;

export type VocabularyLessonManifest = {
  contentType: "manifest";
  lessonId: string;
  randomSeed: number;
  nextCapability: string;
  words: Array<{ id: string }>;
  // The authoritative total word count for the requested list, independent
  // of how many complete word records are currently loaded, so lazy loading
  // never changes lesson statistics or completion.
  totalWordCount: number;
};

// `wordId: null` means the ordered database source is exhausted: no next
// word remains to load. It is never a placeholder or fixture word.
export type VocabularyWordRefillContent = {
  contentType: "word-refill";
  wordId: string | null;
};

export type VocabularyDefinitionDisplayContent = {
  contentType: "definition-display";
  nextCapability: string;
  word: string;
  definition: string;
  exampleSentences: [string, string, string];
};

export type VocabularyDefinitionFunFactContent = {
  contentType: "definition-fun-fact";
  nextCapability: string;
  word: string;
  interestingFact: string;
};

export type VocabularyDefinitionPracticeContent = {
  contentType: "definition-practice";
  nextCapability: string;
  attemptId: string;
  question: string;
  choices: [
    VocabularyChoice,
    VocabularyChoice,
    VocabularyChoice,
    VocabularyChoice,
  ];
};

/**
 * The spelling projection intentionally omits the target word: the canonical
 * written spelling is the graded answer and stays server-only. The attempt ID
 * doubles as the opaque speech reference resolved by the vocabulary speech
 * endpoint.
 */
export type VocabularySpellingPracticeContent = {
  contentType: "spelling-practice";
  nextCapability: string;
  attemptId: string;
  definition: string;
};

export type VocabularyAnswerRecapContent = {
  contentType: "answer-recap";
  nextCapability: string;
  word: string;
  definition: string;
  exampleSentence: string;
};

/**
 * Exactly WORD_SEARCH_CHECKPOINT_GROUP_SIZE plain display words for the
 * ungraded Word Search checkpoint. These words already reached full initial
 * mastery, so displaying them plainly follows the same established pattern
 * as the recap projection's `word` field, not a new answer-security exception.
 */
export type VocabularyWordSearchCheckpointContent = {
  contentType: "word-search-checkpoint";
  nextCapability: string;
  words: string[];
};

export type VocabularyContentResponse =
  | VocabularyLessonManifest
  | VocabularyWordRefillContent
  | VocabularyDefinitionDisplayContent
  | VocabularyDefinitionFunFactContent
  | VocabularyDefinitionPracticeContent
  | VocabularySpellingPracticeContent
  | VocabularyAnswerRecapContent
  | VocabularyWordSearchCheckpointContent;

export type VocabularyContentResponseFor<
  Request extends VocabularyContentRequest,
> = Extract<VocabularyContentResponse, { contentType: Request["contentType"] }>;
