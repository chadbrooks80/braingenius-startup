import "server-only";

import { randomInt as secureRandomInt } from "node:crypto";
import { getVocabularyPublicChoiceId } from "../data/getVocabularyPublicChoiceId";
import type {
  VocabularyChoice,
  VocabularyContentResponse,
  VocabularyScreenContentType,
} from "../data/vocabularyContentTypes";
import { WORD_SEARCH_CHECKPOINT_GROUP_SIZE } from "../data/vocabularyContentTypes";
import type { AuthorizedVocabularyContent } from "./VocabularyContentCapabilityStore";

export type AuthorizedVocabularyContentRequest = AuthorizedVocabularyContent & {
  exampleIndex?: number;
};

// A previously loaded, fully cached list-word record. Content fields stay
// nullable because `ModVocabListWord` allows incomplete content until a
// future Dictionary hydration feature fills missing fields; each content
// case below validates only the fields its own operation needs.
export type VocabularyWordRecord = {
  id: string;
  word: string;
  definition: string | null;
  spellingDefinition: string | null;
  exampleSentence1: string | null;
  exampleSentence2: string | null;
  exampleSentence3: string | null;
  interestingFact: string | null;
};

export type VocabularyDistractorCandidate = {
  id: string;
  definition: string;
};

export type VocabularyAnswerSnapshot =
  | {
      answerType: "definition";
      correctChoiceId: string;
      validChoiceIds: string[];
    }
  | {
      answerType: "spelling";
      canonicalSpelling: string;
      speechDefinition: string;
    };

export type VocabularyContentBuildResult = {
  content: VocabularyContentResponse;
  answerSnapshot: VocabularyAnswerSnapshot | null;
};

/**
 * Everything the content builder needs to resolve canonical fields, supplied
 * by the capability store from its own bounded per-lesson word cache so this
 * module never queries Prisma directly. `findMoreDistractors` is the only
 * operation that may reach the database, and only when the currently active
 * pool cannot supply three eligible distractors on its own.
 */
export type VocabularyContentBuildContext = {
  getWord(wordId: string): VocabularyWordRecord | undefined;
  getActiveDistractorCandidates(
    excludeWordId: string
  ): VocabularyWordRecord[];
  findMoreDistractors(
    excludeWordIds: readonly string[],
    count: number
  ): Promise<VocabularyDistractorCandidate[]>;
};

export async function getVocabularyContent(
  request: AuthorizedVocabularyContentRequest,
  context: VocabularyContentBuildContext,
  randomInt: (maxExclusive: number) => number = secureRandomInt
): Promise<VocabularyContentBuildResult | null> {
  if (request.contentType === "word-search-checkpoint") {
    return buildWordSearchCheckpointContent(request, context);
  }

  const word = context.getWord(request.wordId);
  if (!word) {
    return null;
  }

  switch (request.contentType) {
    case "definition-display":
      return buildDefinitionDisplayContent(request, word);
    case "definition-fun-fact":
      return buildDefinitionFunFactContent(request, word);
    case "definition-practice":
      return buildDefinitionPracticeContent(request, word, context, randomInt);
    case "spelling-practice":
      return buildSpellingPracticeContent(request, word);
    case "answer-recap":
      return buildAnswerRecapContent(request, word);
  }
}

function buildDefinitionDisplayContent(
  request: AuthorizedVocabularyContentRequest,
  word: VocabularyWordRecord
): VocabularyContentBuildResult | null {
  const exampleSentences = requireExampleSentences(word);
  if (!word.definition || !exampleSentences) {
    return null;
  }
  return {
    content: {
      contentType: "definition-display",
      nextCapability: request.nextCapability,
      word: word.word,
      definition: word.definition,
      exampleSentences,
    },
    answerSnapshot: null,
  };
}

function buildDefinitionFunFactContent(
  request: AuthorizedVocabularyContentRequest,
  word: VocabularyWordRecord
): VocabularyContentBuildResult | null {
  if (!word.interestingFact) {
    return null;
  }
  return {
    content: {
      contentType: "definition-fun-fact",
      nextCapability: request.nextCapability,
      word: word.word,
      interestingFact: word.interestingFact,
    },
    answerSnapshot: null,
  };
}

async function buildDefinitionPracticeContent(
  request: AuthorizedVocabularyContentRequest,
  word: VocabularyWordRecord,
  context: VocabularyContentBuildContext,
  randomInt: (maxExclusive: number) => number
): Promise<VocabularyContentBuildResult | null> {
  const attemptId = request.attemptId;
  if (!attemptId || !word.definition) {
    return null;
  }

  const activeCandidates = context
    .getActiveDistractorCandidates(word.id)
    .filter(
      (candidate): candidate is VocabularyWordRecord & { definition: string } =>
        typeof candidate.definition === "string" &&
        candidate.definition.trim() !== ""
    );
  let distractors: VocabularyDistractorCandidate[] = takeRandom(
    activeCandidates.map((candidate) => ({
      id: candidate.id,
      definition: candidate.definition,
    })),
    3,
    randomInt
  );

  if (distractors.length < 3) {
    const need = 3 - distractors.length;
    const excludeIds = [word.id, ...distractors.map((choice) => choice.id)];
    const more = await context.findMoreDistractors(excludeIds, need);
    if (more.length < need) {
      return null;
    }
    distractors = [...distractors, ...takeRandom(more, need, randomInt)];
  }

  if (distractors.length !== 3) {
    return null;
  }

  const internalChoices = shuffle(
    [
      { id: word.id, text: word.definition },
      ...distractors.map((distractor) => ({
        id: distractor.id,
        text: distractor.definition,
      })),
    ],
    randomInt
  );
  const choices = internalChoices.map((choice) => ({
    id: getVocabularyPublicChoiceId(attemptId, choice.id),
    text: choice.text,
  })) as [VocabularyChoice, VocabularyChoice, VocabularyChoice, VocabularyChoice];

  return {
    content: {
      contentType: "definition-practice",
      nextCapability: request.nextCapability,
      attemptId,
      question: word.word,
      choices,
    },
    answerSnapshot: {
      answerType: "definition",
      correctChoiceId: getVocabularyPublicChoiceId(attemptId, word.id),
      validChoiceIds: choices.map((choice) => choice.id),
    },
  };
}

function buildSpellingPracticeContent(
  request: AuthorizedVocabularyContentRequest,
  word: VocabularyWordRecord
): VocabularyContentBuildResult | null {
  const attemptId = request.attemptId;
  if (!attemptId || !word.spellingDefinition || !word.definition) {
    return null;
  }
  return {
    content: {
      contentType: "spelling-practice",
      nextCapability: request.nextCapability,
      attemptId,
      definition: word.spellingDefinition,
    },
    answerSnapshot: {
      answerType: "spelling",
      canonicalSpelling: word.word,
      speechDefinition: word.definition,
    },
  };
}

function buildAnswerRecapContent(
  request: AuthorizedVocabularyContentRequest,
  word: VocabularyWordRecord
): VocabularyContentBuildResult | null {
  const exampleSentences = requireExampleSentences(word);
  if (
    !word.definition ||
    !exampleSentences ||
    request.exampleIndex === undefined ||
    request.exampleIndex < 0 ||
    request.exampleIndex >= exampleSentences.length
  ) {
    return null;
  }
  return {
    content: {
      contentType: "answer-recap",
      nextCapability: request.nextCapability,
      word: word.word,
      definition: word.definition,
      exampleSentence: exampleSentences[request.exampleIndex],
    },
    answerSnapshot: null,
  };
}

function buildWordSearchCheckpointContent(
  request: AuthorizedVocabularyContentRequest,
  context: VocabularyContentBuildContext
): VocabularyContentBuildResult | null {
  const wordIds = request.wordIds;
  if (!wordIds || wordIds.length !== WORD_SEARCH_CHECKPOINT_GROUP_SIZE) {
    return null;
  }

  const words: string[] = [];
  for (const wordId of wordIds) {
    const word = context.getWord(wordId);
    if (!word) {
      return null;
    }
    words.push(word.word);
  }

  return {
    content: {
      contentType: "word-search-checkpoint",
      nextCapability: request.nextCapability,
      words,
    },
    answerSnapshot: null,
  };
}

function requireExampleSentences(
  word: VocabularyWordRecord
): [string, string, string] | null {
  if (
    !word.exampleSentence1 ||
    !word.exampleSentence2 ||
    !word.exampleSentence3
  ) {
    return null;
  }
  return [word.exampleSentence1, word.exampleSentence2, word.exampleSentence3];
}

function takeRandom<T>(
  items: readonly T[],
  count: number,
  randomInt: (maxExclusive: number) => number
): T[] {
  return shuffle(items, randomInt).slice(0, count);
}

function shuffle<T>(
  items: readonly T[],
  randomInt: (maxExclusive: number) => number
): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

// Only VocabularyScreenContentType-shaped requests reach getVocabularyContent;
// re-exported so callers can narrow AuthorizedVocabularyContentRequest.
export type { VocabularyScreenContentType };
