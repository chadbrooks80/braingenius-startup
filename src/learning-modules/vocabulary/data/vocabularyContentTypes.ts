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
] as const;

export type VocabularyScreenContentType =
  (typeof VOCABULARY_SCREEN_CONTENT_TYPES)[number];

export type VocabularyLessonManifestRequest = {
  contentType: "manifest";
  wordListId: string;
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

export type VocabularyContentRequest =
  | VocabularyLessonManifestRequest
  | VocabularyDefinitionDisplayRequest
  | VocabularyDefinitionFunFactRequest
  | VocabularyDefinitionPracticeRequest
  | VocabularySpellingPracticeRequest
  | VocabularyAnswerRecapRequest;

export type VocabularyLessonManifest = {
  contentType: "manifest";
  lessonId: string;
  randomSeed: number;
  nextCapability: string;
  words: Array<{ id: string }>;
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

export type VocabularyContentResponse =
  | VocabularyLessonManifest
  | VocabularyDefinitionDisplayContent
  | VocabularyDefinitionFunFactContent
  | VocabularyDefinitionPracticeContent
  | VocabularySpellingPracticeContent
  | VocabularyAnswerRecapContent;

export type VocabularyContentResponseFor<
  Request extends VocabularyContentRequest,
> = Extract<VocabularyContentResponse, { contentType: Request["contentType"] }>;
