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
import { getWordList } from "../../src/learning-modules/vocabulary/data/getWordList";

export function createInProcessVocabularyApi(): VocabularyModuleApi {
  const capabilityStore = new VocabularyContentCapabilityStore();
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
            return null;
          }
          return capabilityStore.resolveAnswer(
            learnerId,
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

export function getServerCorrectChoiceId(
  content: VocabularyDefinitionPracticeContent
): string {
  const word = getWordList("word_list_id")?.find(
    (candidate) => candidate.word === content.question
  );
  if (!word) {
    throw new Error(`No fixture word exists for ${content.question}.`);
  }
  const result = getVocabularyAnswerForAttempt(
    {
      learnerId: "00000000-0000-4000-8000-000000000001",
      lessonId: "00000000-0000-4000-8000-000000000002",
      wordListId: "word_list_id",
      wordId: word.id,
      answerType: "definition",
      attemptId: content.attemptId,
    },
    {
      answerType: "definition",
      attemptId: content.attemptId,
      selectedChoiceId: content.choices[0].id,
    }
  );
  if (!result || result.answerType !== "definition") {
    throw new Error(`No server answer exists for ${content.attemptId}.`);
  }
  return result.correctChoiceId;
}

export function getServerSpellingAnswer(
  content: VocabularySpellingPracticeContent
): string {
  const word = getWordList("word_list_id")?.find(
    (candidate) => candidate.spellingDefinition === content.definition
  );
  if (!word) {
    throw new Error(`No fixture spelling exists for ${content.attemptId}.`);
  }
  return word.word;
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
