import "server-only";

import type {
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "../types";
import {
  evaluateVocabularyAnswer,
  type DefinitionFixtureAnswer,
  type FixtureAnswer,
  type SpellingFixtureAnswer,
} from "./evaluateVocabularyAnswer";
import { getVocabularyPublicChoiceId } from "./getVocabularyPublicChoiceId";
import { getWordList } from "./getWordList";
import type { VocabularyAttemptAuthorization } from "../server/VocabularyContentCapabilityStore";

const FIXTURE_ANSWERS: Record<string, FixtureAnswer> = {
  "323ac488-1422-4231-aab1-de2cc908d920": definition("br-a", "br"),
  "09e2392a-f108-4070-88fa-7bb5787a31b5": spelling("brilliant"),
  "1d5175c1-4b32-4901-a7a6-b70c143b203c": definition("ca-b", "ca"),
  "ca846ce1-448b-481c-936f-3f520a4750f6": spelling("cautious"),
  "c40a7697-b163-4253-b07b-9d2e0ce91dc0": definition("ob-c", "ob"),
  "2aeb7f9a-78a4-483c-987b-9d8b9189cadf": spelling("observe"),
  "efb3885e-b676-46a5-82db-5fcef67150a5": definition("re-d", "re"),
  "09f6b5ba-c7bf-4946-be67-6516328c5083": spelling("reluctant"),
  "07eebe5c-df58-4fc4-823a-9f83bf69072e": definition("fo-a", "fo"),
  "be833ca4-c5cf-43b6-871d-6f512ea94ff5": spelling("fortunate"),
  "ecb55b4f-00e5-452d-b6ce-3abbbc37c9bf": definition("ab-b", "ab"),
  "c706d40f-1daa-4670-a334-d1469f1e5ec9": spelling("abundant"),
  "e5dd59b1-cf5e-4c73-abef-7536c9e12486": definition("ac-c", "ac"),
  "31665228-d13e-4c4b-8cf4-dd7d35c87627": spelling("accomplish"),
  "505809cf-014a-48a0-8077-da8ccc12205e": definition("ak-d", "ak"),
  "3714b51a-f5b6-408e-af0e-887f913289e9": spelling("accurate"),
  "81b518d8-97d1-4737-9866-754e4bdbf931": definition("ad-a", "ad"),
  "43125381-a654-415a-9c34-71b883f989e2": spelling("adapt"),
  "127a864d-6975-4871-975b-44451a853673": definition("an-b", "an"),
  "73d551a1-9c09-469e-a5e3-a08a65af8901": spelling("analyze"),
  "9752c7a3-919c-41f8-b388-30f94d9771d6": definition("at-c", "at"),
  "83804de2-9eac-4b26-a37f-2f9827bde665": spelling("anticipate"),
  "bc75df86-424d-4e2e-a7cb-2a7c9766f4a0": definition("co-d", "co"),
  "0dc7904a-47d2-4469-9165-8a5599a609ee": spelling("conclude"),
  "a3faa434-3f0a-415f-b2e4-98319cc1687c": definition("ct-a", "ct"),
  "fe110826-7bf5-4248-b01c-88a3d3918106": spelling("contrast"),
  "27c4a796-8077-4020-950f-0571a7530f48": definition("de-b", "de"),
  "f7a52ea6-95d3-4a8b-8d33-38738530c1be": spelling("demonstrate"),
  "70f41db9-07af-4ba0-b2f4-7bd9edd589dd": definition("es-c", "es"),
  "429b4c08-abc1-46f4-8dff-a06a9f8136a1": spelling("essential"),
  "acd39bcf-1f93-4cf8-a26c-96f40e0c7483": definition("ex-d", "ex"),
  "a0df0848-32f3-4303-b627-62e3b1e9823e": spelling("expand"),
  "69b7b768-d6f9-418b-baca-a1be40ef7f48": definition("fr-a", "fr"),
  "4a52f209-ba1e-4b9c-99b9-d4b946d8ecc0": spelling("fragile"),
  "7720a616-e81f-465a-8caf-9a366f96a98f": definition("pr-b", "pr"),
  "f5becfc7-fa6e-463e-82a8-c07bd9433a17": spelling("predict"),
  "97a0e295-2e0d-4b20-89f9-0c53cbfa55fb": definition("sc-c", "sc"),
  "d441e231-f038-4cb3-9f20-ec2ece781096": spelling("scarce"),
  "d0a7dd50-8c2e-4ae6-a9ae-faaec6a040a2": definition("tr-d", "tr"),
  "6e818c9f-0d49-4e6c-be58-14e0304b7089": spelling("transform"),
};

function definition(
  correctChoiceId: string,
  prefix: string
): DefinitionFixtureAnswer {
  return {
    answerType: "definition",
    correctChoiceId,
    validChoiceIds: ["a", "b", "c", "d"].map(
      (suffix) => `${prefix}-${suffix}`
    ),
  };
}

function spelling(displayAnswer: string): SpellingFixtureAnswer {
  return {
    answerType: "spelling",
    acceptedAnswers: [displayAnswer.toLocaleLowerCase("en-US")],
    displayAnswer,
  };
}

export function getVocabularyAnswer(
  submission: VocabularyAnswerSubmission
): VocabularyAnswerResult | null {
  const fixtureAnswer = FIXTURE_ANSWERS[submission.attemptId];
  const publicAnswer =
    fixtureAnswer?.answerType === "definition"
      ? {
          ...fixtureAnswer,
          correctChoiceId: getVocabularyPublicChoiceId(
            submission.attemptId,
            fixtureAnswer.correctChoiceId
          ),
          validChoiceIds: fixtureAnswer.validChoiceIds.map((choiceId) =>
            getVocabularyPublicChoiceId(submission.attemptId, choiceId)
          ),
        }
      : fixtureAnswer;

  return evaluateVocabularyAnswer(publicAnswer, submission);
}

export function getVocabularyAnswerForAttempt(
  attempt: VocabularyAttemptAuthorization,
  submission: VocabularyAnswerSubmission
): VocabularyAnswerResult | null {
  if (
    attempt.attemptId !== submission.attemptId ||
    attempt.answerType !== submission.answerType
  ) {
    return null;
  }

  const word = getWordList(attempt.wordListId)?.find(
    (candidate) => candidate.id === attempt.wordId
  );
  if (!word) {
    return null;
  }

  const fixtureAttemptId =
    submission.answerType === "definition"
      ? word.definitionAttemptId
      : word.spellingAttemptId;
  const fixtureAnswer = FIXTURE_ANSWERS[fixtureAttemptId];
  const publicAnswer =
    fixtureAnswer?.answerType === "definition"
      ? {
          ...fixtureAnswer,
          correctChoiceId: getVocabularyPublicChoiceId(
            submission.attemptId,
            fixtureAnswer.correctChoiceId
          ),
          validChoiceIds: fixtureAnswer.validChoiceIds.map((choiceId) =>
            getVocabularyPublicChoiceId(submission.attemptId, choiceId)
          ),
        }
      : fixtureAnswer;

  return evaluateVocabularyAnswer(publicAnswer, submission);
}
