import { handleVocabularyAnswerRequest } from "../../src/app/api/learning/vocabulary/submit-answer/handleVocabularyAnswerRequest";
import { getVocabularyAnswerForAttempt } from "../../src/learning-modules/vocabulary/data/getCorrectAnswer";
import type {
  VocabularyContentRequest,
  VocabularyContentResponseFor,
  VocabularyDefinitionPracticeContent,
  VocabularySpellingPracticeContent,
} from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import type { VocabularyModuleApi } from "../../src/learning-modules/vocabulary/index";
import type {
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "../../src/learning-modules/vocabulary/types";
import { handleVocabularyContentRequest } from "../../src/learning-modules/vocabulary/server/handleVocabularyContentRequest";
import { VocabularyContentCapabilityStore } from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import { getVocabularyLearnerId } from "../../src/learning-modules/vocabulary/server/vocabularyLearnerSession";
import {
  createDefaultFakeVocabularyListSource,
  TEST_OWNER_USER_ID,
  TEST_WORD_SEEDS,
} from "./fakeVocabularyListStore";

export function createInProcessVocabularyApi(
  userId: string = TEST_OWNER_USER_ID,
  capabilityStore: VocabularyContentCapabilityStore = new VocabularyContentCapabilityStore(
    { listSource: createDefaultFakeVocabularyListSource() }
  )
): VocabularyModuleApi {
  let cookie: string | null = null;

  return {
    async loadContent<Request extends VocabularyContentRequest>(
      request: Request
    ): Promise<VocabularyContentResponseFor<Request> | null> {
      const response = await handleVocabularyContentRequest(
        jsonRequest(
          "http://local.test/api/learning/vocabulary/content",
          request,
          cookie
        ),
        userId,
        capabilityStore
      );
      cookie = response.headers.get("set-cookie")?.split(";", 1)[0] ?? cookie;
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
    ): Promise<VocabularyAnswerResult> {
      const response = await handleVocabularyAnswerRequest(
        jsonRequest(
          "http://local.test/api/learning/vocabulary/submit-answer",
          submission,
          cookie
        ),
        (parsedSubmission) => {
          const learnerId = getVocabularyLearnerId(
            jsonRequest("http://local.test", {}, cookie)
          );
          if (!learnerId) {
            return Promise.resolve(null);
          }
          return capabilityStore.resolveAnswer(
            learnerId,
            userId,
            parsedSubmission,
            getVocabularyAnswerForAttempt
          );
        }
      );
      if (!response.ok) {
        throw new Error(
          `Answer handler failed with status ${response.status}.`
        );
      }
      return (await response.json()) as VocabularyAnswerResult;
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

function jsonRequest(
  url: string,
  body: unknown,
  cookie: string | null
): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (cookie) {
    headers.set("Cookie", cookie);
  }
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
