import { handleVocabularyAnswerRequest } from "../../src/app/api/learning/vocabulary/submit-answer/handleVocabularyAnswerRequest";
import type {
  VocabularyContentRequest,
  VocabularyContentResponseFor,
  VocabularyDefinitionPracticeContent,
  VocabularySpellingPracticeContent,
} from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import type { VocabularyModuleApi } from "../../src/learning-modules/vocabulary/index";
import type {
  VocabularyAnswerApiResult,
  VocabularyAnswerSubmission,
} from "../../src/learning-modules/vocabulary/types";
import { handleVocabularyContentRequest } from "../../src/learning-modules/vocabulary/server/handleVocabularyContentRequest";
import { VocabularyContentCapabilityStore } from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import {
  createDefaultFakeVocabularyListSource,
  TEST_LIST_ID,
  TEST_OWNER_USER_ID,
  TEST_WORD_SEEDS,
} from "./fakeVocabularyListStore";
import {
  createFakeVocabularyLearningSource,
  type FakeVocabularyLearningSource,
} from "./fakeVocabularyLearningStore";
import { createFakeVocabularyRuntimeStore } from "./fakeVocabularyRuntimeStore";

// The authenticated `ModVocabLearning.id` used by default across Vocabulary
// tests, distinct from `TEST_LIST_ID` (the reusable `ModVocabList.id` it
// resolves through). Matches the feature's `learningId` route/authorization
// contract instead of authorizing by list ownership.
export const TEST_LEARNING_ID = "test-learning-chads-starter-words";

export function createDefaultFakeVocabularyLearningSource(
  userId: string = TEST_OWNER_USER_ID,
  learningId: string = TEST_LEARNING_ID,
  listId: string = TEST_LIST_ID
): FakeVocabularyLearningSource {
  return createFakeVocabularyLearningSource(
    [{ learningId, listId, learnerUserId: userId }],
    TEST_WORD_SEEDS.map((seed, index) => ({
      listId,
      id: `${listId}-word-${index + 1}`,
      position: index + 1,
      word: seed.word,
      definition: seed.definition,
    }))
  );
}

export function createInProcessVocabularyApi(
  userId: string = TEST_OWNER_USER_ID,
  capabilityStore: VocabularyContentCapabilityStore = new VocabularyContentCapabilityStore({
    listSource: createDefaultFakeVocabularyListSource(),
    learningSource: createDefaultFakeVocabularyLearningSource(userId),
    runtimeStore: createFakeVocabularyRuntimeStore(),
  })
): VocabularyModuleApi {
  return {
    async loadContent<Request extends VocabularyContentRequest>(
      request: Request
    ): Promise<VocabularyContentResponseFor<Request> | null> {
      const response = await handleVocabularyContentRequest(
        jsonRequest("http://local.test/api/learning/vocabulary/content", request),
        userId,
        capabilityStore
      );
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(
          `Content handler failed with status ${response.status}.`
        );
      }
      return (await response.json()) as VocabularyContentResponseFor<Request>;
    },
    async submitAnswer(
      submission: VocabularyAnswerSubmission
    ): Promise<VocabularyAnswerApiResult> {
      const response = await handleVocabularyAnswerRequest(
        jsonRequest(
          "http://local.test/api/learning/vocabulary/submit-answer",
          submission
        ),
        (parsedSubmission) => capabilityStore.resolveAnswer(userId, parsedSubmission)
      );
      if (!response.ok) {
        throw new Error(
          `Answer handler failed with status ${response.status}.`
        );
      }
      return (await response.json()) as VocabularyAnswerApiResult;
    },
  };
}

// The correct answer is never fetched from a server-only lookup: the
// definition CHOICE TEXT is already public in the content response, so
// tests discover the correct public choice ID the same way a legitimate
// learner effectively could not (by knowing the seeded definition), without
// requiring any test-only production export of canonical grading data.
export function getServerCorrectChoiceId(
  content: VocabularyDefinitionPracticeContent
): string {
  const seed = TEST_WORD_SEEDS.find((candidate) => candidate.word === content.question);
  if (!seed) {
    throw new Error(`No seed word exists for ${content.question}.`);
  }
  const correctChoice = content.choices.find(
    (choice) => choice.text === seed.definition
  );
  if (!correctChoice) {
    throw new Error(`No matching choice exists for ${content.attemptId}.`);
  }
  return correctChoice.id;
}

export function getServerSpellingAnswer(
  content: VocabularySpellingPracticeContent
): string {
  const seed = TEST_WORD_SEEDS.find(
    (candidate) => candidate.spellingDefinition === content.definition
  );
  if (!seed) {
    throw new Error(`No seed spelling exists for ${content.attemptId}.`);
  }
  return seed.word;
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
