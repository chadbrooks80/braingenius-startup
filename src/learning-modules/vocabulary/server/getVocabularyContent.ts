import "server-only";

import { randomInt as secureRandomInt, randomUUID } from "node:crypto";
import { getWordList } from "../data/getWordList";
import { getVocabularyPublicChoiceId } from "../data/getVocabularyPublicChoiceId";
import type {
  VocabularyChoice,
  VocabularyContentResponse,
  VocabularyScreenContentType,
} from "../data/vocabularyContentTypes";
import type { AuthorizedVocabularyContent } from "./VocabularyContentCapabilityStore";

export type AuthorizedVocabularyContentRequest = AuthorizedVocabularyContent & {
  exampleIndex?: number;
};

export type CanonicalVocabularyContentRequest = {
  contentType: VocabularyScreenContentType;
  wordListId: string;
  wordId: string;
  exampleIndex?: number;
};

export function getVocabularyContent<
  Request extends
    | AuthorizedVocabularyContentRequest
    | CanonicalVocabularyContentRequest,
>(
  request: Request,
  randomInt: (maxExclusive: number) => number = secureRandomInt
): Extract<
  VocabularyContentResponse,
  { contentType: Request["contentType"] }
> | null {
  const words = getWordList(request.wordListId);
  if (!words) {
    return null;
  }

  const word = words.find((candidate) => candidate.id === request.wordId);
  if (!word) {
    return null;
  }

  const nextCapability =
    "nextCapability" in request ? request.nextCapability : randomUUID();
  const attemptId =
    "attemptId" in request
      ? request.attemptId
      : request.contentType === "definition-practice"
        ? word.definitionAttemptId
        : request.contentType === "spelling-practice"
          ? word.spellingAttemptId
          : null;

  switch (request.contentType) {
    case "definition-display":
      return {
        contentType: "definition-display",
        nextCapability,
        word: word.word,
        definition: word.definition,
        exampleSentences: [...word.exampleSentences],
      } as Extract<
        VocabularyContentResponse,
        { contentType: Request["contentType"] }
      >;
    case "definition-fun-fact":
      return {
        contentType: "definition-fun-fact",
        nextCapability,
        word: word.word,
        interestingFact: word.interestingFact,
      } as Extract<
        VocabularyContentResponse,
        { contentType: Request["contentType"] }
      >;
    case "definition-practice":
      if (!attemptId) {
        return null;
      }
      return {
        contentType: "definition-practice",
        nextCapability,
        attemptId,
        question: word.word,
        choices: shuffledPublicChoices(
          attemptId,
          word.choices,
          randomInt
        ),
      } as Extract<
        VocabularyContentResponse,
        { contentType: Request["contentType"] }
      >;
    case "spelling-practice":
      if (!attemptId) {
        return null;
      }
      return {
        contentType: "spelling-practice",
        nextCapability,
        attemptId,
        definition: word.spellingDefinition,
      } as Extract<
        VocabularyContentResponse,
        { contentType: Request["contentType"] }
      >;
    case "answer-recap":
      if (
        request.exampleIndex === undefined ||
        request.exampleIndex < 0 ||
        request.exampleIndex >= word.exampleSentences.length
      ) {
        return null;
      }
      return {
        contentType: "answer-recap",
        nextCapability,
        word: word.word,
        definition: word.definition,
        exampleSentence: word.exampleSentences[request.exampleIndex],
      } as Extract<
        VocabularyContentResponse,
        { contentType: Request["contentType"] }
      >;
  }
}

function shuffledPublicChoices(
  attemptId: string,
  choices: VocabularyChoice[],
  randomInt: (maxExclusive: number) => number
): [VocabularyChoice, VocabularyChoice, VocabularyChoice, VocabularyChoice] {
  const publicChoices = choices.map((choice) => ({
    id: getVocabularyPublicChoiceId(attemptId, choice.id),
    text: choice.text,
  }));

  for (let index = publicChoices.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [publicChoices[index], publicChoices[swapIndex]] = [
      publicChoices[swapIndex],
      publicChoices[index],
    ];
  }

  return publicChoices as [
    VocabularyChoice,
    VocabularyChoice,
    VocabularyChoice,
    VocabularyChoice,
  ];
}
