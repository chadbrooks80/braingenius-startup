import { randomUUID } from "node:crypto";
import type {
  VocabularyDistractorRow,
  VocabularyListWordRow,
} from "../../src/learning-modules/vocabulary/server/vocabularyListStore";
import type { VocabularyListSource } from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import type { VocabularyContentBuildContext } from "../../src/learning-modules/vocabulary/server/getVocabularyContent";

// Deterministic in-memory double for the module-owned `ModVocabList`/
// `ModVocabListWord` repository, matching the existing
// ttsUsageService/effective-subscription-tier fake-store test convention.
// No test in this repository may contact a real (production) database;
// every Vocabulary unit/integration test in this suite is expected to
// inject one of these instead of the real Prisma-backed VocabularyListSource.

export type FakeVocabularyWordSeed = {
  word: string;
  definition: string | null;
  spellingDefinition: string | null;
  exampleSentence1: string | null;
  exampleSentence2: string | null;
  exampleSentence3: string | null;
  interestingFact: string | null;
};

export type FakeVocabularyList = {
  listId: string;
  ownerUserId: string;
  words: VocabularyListWordRow[];
};

export const TEST_LIST_ID = "test-list-chads-starter-words";
export const TEST_OWNER_USER_ID = "test-user-owner";
export const OTHER_USER_ID = "test-user-other";

export function createFakeVocabularyList(
  listId: string,
  ownerUserId: string,
  seeds: readonly FakeVocabularyWordSeed[]
): FakeVocabularyList {
  return {
    listId,
    ownerUserId,
    words: seeds.map((seed, index) => ({
      id: `${listId}-word-${index + 1}`,
      position: index + 1,
      ...seed,
    })),
  };
}

export type FakeVocabularyOperation = "findNext" | "findDistractors" | "findByIds";

export type FakeVocabularyListSource = VocabularyListSource & {
  failNext(operation: FakeVocabularyOperation): void;
};

export function createFakeVocabularyListSource(
  lists: readonly FakeVocabularyList[]
): FakeVocabularyListSource {
  let failNextOperation: FakeVocabularyOperation | null = null;

  function maybeFail(operation: FakeVocabularyOperation): void {
    if (failNextOperation === operation) {
      failNextOperation = null;
      throw new Error(`simulated ${operation} failure`);
    }
  }

  function findList(listId: string): FakeVocabularyList | undefined {
    return lists.find((candidate) => candidate.listId === listId);
  }

  return {
    failNext(operation) {
      failNextOperation = operation;
    },
    async findByIds(listId, ids) {
      maybeFail("findByIds");
      const list = findList(listId);
      if (!list) {
        return [];
      }
      return list.words.filter((word) => ids.includes(word.id));
    },
    async findNext(listId, afterPosition) {
      maybeFail("findNext");
      const list = findList(listId);
      if (!list) {
        return null;
      }
      const next = [...list.words]
        .filter((word) => word.position > afterPosition)
        .sort((left, right) => left.position - right.position)[0];
      return next ?? null;
    },
    async findDistractors(listId, excludeIds, take): Promise<VocabularyDistractorRow[]> {
      maybeFail("findDistractors");
      const list = findList(listId);
      if (!list) {
        return [];
      }
      return list.words
        .filter(
          (word): word is VocabularyListWordRow & { definition: string } =>
            !excludeIds.includes(word.id) &&
            typeof word.definition === "string" &&
            word.definition.trim() !== ""
        )
        .slice(0, take)
        .map((word) => ({ id: word.id, definition: word.definition }));
    },
  };
}

// The realistic 20-word content set formerly served by the deleted
// production fixture (`getWordList.ts`), now used only as deterministic
// test seed data for the fake repository.
export const TEST_WORD_SEEDS: readonly FakeVocabularyWordSeed[] = [
  word("brilliant", "showing exceptional intelligence, talent, or skill", "having unusually strong intelligence or talent", [
    "Nia had a brilliant idea for the science fair.",
    "The brilliant pianist learned the difficult song quickly.",
    "A brilliant solution helped the team save time.",
  ], "Brilliant can describe a very smart idea and also a light that shines intensely."),
  word("cautious", "acting with care because danger or mistakes are possible", "careful because something could go wrong", [
    "The cautious hiker checked the trail map twice.",
    "Be cautious when carrying the full glass of water.",
    "Mara gave a cautious answer because she was not completely sure.",
  ], "Cautious comes from a Latin word connected to being on guard."),
  word("observe", "to pay close attention so you can notice details", "to watch closely and notice details", [
    "We used binoculars to observe birds near the lake.",
    "Observe how the ice changes as it warms.",
    "The detective paused to observe every detail in the room.",
  ], "Scientists observe carefully so they can record evidence before drawing conclusions."),
  word("reluctant", "not eager to act because you feel unsure or unwilling", "hesitant because you do not want to act", [
    "Eli was reluctant to speak in front of the crowd.",
    "The cat seemed reluctant to step into the snow.",
    "I felt reluctant at first, but the new game was fun.",
  ], "Reluctant describes holding back even when someone may eventually agree."),
  word("fortunate", "having an outcome shaped by good luck", "having good results because of luck", [
    "We were fortunate that the rain stopped before the picnic.",
    "The fortunate winner received two tickets to the game.",
    "Kai felt fortunate to have helpful neighbors.",
  ], "Fortunate is related to fortune, a word that can mean luck or chance."),
  word("abundant", "available in more than enough quantity", "present in a quantity greater than needed", [
    "Wildflowers were abundant across the sunny field.",
    "After the harvest, the market had an abundant supply of apples.",
    "Rain is abundant in a tropical rainforest.",
  ], "Abundant shares a Latin root with a word meaning to overflow."),
  word("accomplish", "to complete a goal through effort or skill", "to finish a goal successfully through effort", [
    "Our class worked together to accomplish its reading goal.",
    "Jules practiced daily to accomplish the difficult climb.",
    "A checklist helped me accomplish every task before dinner.",
  ], "An accomplishment is something completed through effort or skill."),
  word("accurate", "matching the facts without errors", "correct and free from errors", [
    "The map gave an accurate picture of the hiking trail.",
    "Please use a ruler so your measurement is accurate.",
    "Her report was accurate because she checked every fact.",
  ], "Accurate information matches the facts as closely as possible."),
  word("adapt", "to adjust so something works in a different situation", "to change so you fit a new situation", [
    "Desert plants adapt to survive with very little water.",
    "We had to adapt our plans when the gym closed.",
    "The puppy quickly adapted to its new home.",
  ], "Living things may adapt over time, while people can adapt their plans right away."),
  word("analyze", "to study the parts of something to understand the whole", "to examine parts carefully to understand a whole", [
    "The students analyze the chart before answering questions.",
    "We can analyze the clues to solve the mystery.",
    "Scientists analyze samples of soil in the lab.",
  ], "To analyze often means separating an idea into parts and studying how they connect."),
  word("anticipate", "to think ahead about what may happen and get ready", "to expect what may happen and prepare", [
    "We anticipate heavy traffic, so we will leave early.",
    "The goalie tried to anticipate where the ball would go.",
    "Farmers anticipate cold weather by protecting young plants.",
  ], "Anticipate is related to a Latin word meaning to take care of something beforehand."),
  word("conclude", "to reach a decision from evidence or finish an activity", "to decide from evidence or bring something to an end", [
    "From the tracks, we can conclude that a deer crossed the path.",
    "The speaker will conclude the program with a short poem.",
    "After comparing the evidence, Mina concluded that her guess was right.",
  ], "A conclusion can be the final part of a text or a decision based on evidence."),
  word("contrast", "to examine things by focusing on their differences", "to show how things differ from one another", [
    "Contrast the two characters by describing their different choices.",
    "The white flowers contrast with the dark green leaves.",
    "Our report will compare and contrast city and country life.",
  ], "Contrast can be a verb for showing differences or a noun for the difference itself."),
  word("demonstrate", "to make an idea clear by showing how it works", "to explain clearly by showing an example", [
    "The coach will demonstrate how to hold the bat.",
    "Use the model to demonstrate how the planets move.",
    "Tariq demonstrated kindness by helping the new student.",
  ], "A demonstration helps an audience understand by letting them see an idea in action."),
  word("essential", "needed so much that something cannot work well without it", "so necessary that something cannot work without it", [
    "Clean water is essential for good health.",
    "A helmet is essential safety gear for biking.",
    "Listening is an essential part of teamwork.",
  ], "The essential part of something is the part it cannot do without."),
  word("expand", "to grow in size, range, or amount of information", "to become larger or add more detail", [
    "Warm air can expand and take up more space.",
    "Please expand your paragraph with another example.",
    "The library plans to expand its graphic novel section.",
  ], "Expand comes from a Latin word that means to spread out."),
  word("fragile", "delicate enough to be damaged without much force", "easily damaged or broken", [
    "The fragile glass ornament was wrapped in soft paper.",
    "A butterfly's wings are beautiful but fragile.",
    "The package had a label warning that its contents were fragile.",
  ], "Fragile comes from the same Latin root as fracture, a word for a break or crack."),
  word("predict", "to use clues or evidence to tell what may happen next", "to say what is likely to happen using evidence", [
    "Dark clouds helped us predict that rain was coming.",
    "Can you predict how the character will solve the problem?",
    "The scientist used data to predict the path of the storm.",
  ], "A prediction is strongest when it is supported by evidence rather than a random guess."),
  word("scarce", "available in such a small supply that it is difficult to get", "hard to obtain because too little is available", [
    "Fresh water is scarce in some dry regions.",
    "Tickets became scarce as the concert date approached.",
    "Food was scarce for the animals during the long winter.",
  ], "Scarce describes a limited supply, while rare often describes something unusual."),
  word("transform", "to become very different in shape, form, or appearance", "to change greatly in form or appearance", [
    "A caterpillar will transform into a butterfly.",
    "Paint and new lights transformed the old room.",
    "Heat can transform ice into liquid water.",
  ], "The prefix trans- can mean across or beyond, and form refers to shape."),
];

function word(
  wordText: string,
  definition: string,
  spellingDefinition: string,
  exampleSentences: [string, string, string],
  interestingFact: string
): FakeVocabularyWordSeed {
  return {
    word: wordText,
    definition,
    spellingDefinition,
    exampleSentence1: exampleSentences[0],
    exampleSentence2: exampleSentences[1],
    exampleSentence3: exampleSentences[2],
    interestingFact,
  };
}

/**
 * A standalone content-build context over a fixed word set, for tests that
 * exercise `getVocabularyContent` directly without a capability store or
 * lesson-state-driven active pool. `getActiveDistractorCandidates` returns
 * every other word in the set, which is a superset of what any real active
 * pool would offer.
 */
export function createFakeContentBuildContext(
  words: readonly VocabularyListWordRow[],
  onDefinitionAttemptCreated?: (attemptId: string, correctChoiceId: string) => void
): VocabularyContentBuildContext {
  return {
    getWord: (wordId) => words.find((word) => word.id === wordId),
    getActiveDistractorCandidates: (excludeWordId) =>
      words.filter((word) => word.id !== excludeWordId),
    async findMoreDistractors(excludeIds, count) {
      return words
        .filter(
          (word): word is VocabularyListWordRow & { definition: string } =>
            !excludeIds.includes(word.id) &&
            typeof word.definition === "string" &&
            word.definition.trim() !== ""
        )
        .slice(0, count)
        .map((word) => ({ id: word.id, definition: word.definition }));
    },
    async createDefinitionAttempt(_listWordId, _review, choices) {
      const attemptId = randomUUID();
      const choiceIds = choices.map(() => randomUUID());
      const correctIndex = choices.findIndex((choice) => choice.isCorrect);
      if (onDefinitionAttemptCreated && correctIndex >= 0) {
        onDefinitionAttemptCreated(attemptId, choiceIds[correctIndex]);
      }
      return { attemptId, choiceIds };
    },
    async createSpellingAttempt() {
      return { attemptId: randomUUID() };
    },
  };
}

/** A ready-to-use fake source with one 20-word list owned by TEST_OWNER_USER_ID. */
export function createDefaultFakeVocabularyListSource(): FakeVocabularyListSource {
  return createFakeVocabularyListSource([
    createFakeVocabularyList(TEST_LIST_ID, TEST_OWNER_USER_ID, TEST_WORD_SEEDS),
  ]);
}
