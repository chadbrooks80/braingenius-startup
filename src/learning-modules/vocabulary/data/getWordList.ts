import "server-only";

import type { VocabularyChoice } from "./vocabularyContentTypes";

export type VocabularyWord = {
  id: string;
  word: string;
  definition: string;
  spellingDefinition: string;
  exampleSentences: [string, string, string];
  interestingFact: string;
  definitionAttemptId: string;
  choices: [
    VocabularyChoice,
    VocabularyChoice,
    VocabularyChoice,
    VocabularyChoice,
  ];
  spellingAttemptId: string;
};

const WORD_LIST: VocabularyWord[] = [
  {
    id: "word-01",
    word: "brilliant",
    definition: "showing exceptional intelligence, talent, or skill",
    spellingDefinition: "having unusually strong intelligence or talent",
    exampleSentences: [
      "Nia had a brilliant idea for the science fair.",
      "The brilliant pianist learned the difficult song quickly.",
      "A brilliant solution helped the team save time.",
    ],
    interestingFact:
      "Brilliant can describe a very smart idea and also a light that shines intensely.",
    definitionAttemptId: "323ac488-1422-4231-aab1-de2cc908d920",
    spellingAttemptId: "09e2392a-f108-4070-88fa-7bb5787a31b5",
    choices: [
      { id: "br-a", text: "extremely intelligent or talented" },
      { id: "br-b", text: "very tired or exhausted" },
      { id: "br-c", text: "small in size or amount" },
      { id: "br-d", text: "quiet and reserved" },
    ],
  },
  {
    id: "word-02",
    word: "cautious",
    definition: "acting with care because danger or mistakes are possible",
    spellingDefinition: "careful because something could go wrong",
    exampleSentences: [
      "The cautious hiker checked the trail map twice.",
      "Be cautious when carrying the full glass of water.",
      "Mara gave a cautious answer because she was not completely sure.",
    ],
    interestingFact:
      "Cautious comes from a Latin word connected to being on guard.",
    definitionAttemptId: "1d5175c1-4b32-4901-a7a6-b70c143b203c",
    spellingAttemptId: "ca846ce1-448b-481c-936f-3f520a4750f6",
    choices: [
      { id: "ca-a", text: "willing to act without thinking" },
      { id: "ca-b", text: "careful to avoid danger or mistakes" },
      { id: "ca-c", text: "loud and easy to notice" },
      { id: "ca-d", text: "happening by accident" },
    ],
  },
  {
    id: "word-03",
    word: "observe",
    definition: "to pay close attention so you can notice details",
    spellingDefinition: "to watch closely and notice details",
    exampleSentences: [
      "We used binoculars to observe birds near the lake.",
      "Observe how the ice changes as it warms.",
      "The detective paused to observe every detail in the room.",
    ],
    interestingFact:
      "Scientists observe carefully so they can record evidence before drawing conclusions.",
    definitionAttemptId: "c40a7697-b163-4253-b07b-9d2e0ce91dc0",
    spellingAttemptId: "2aeb7f9a-78a4-483c-987b-9d8b9189cadf",
    choices: [
      { id: "ob-a", text: "to build something from pieces" },
      { id: "ob-b", text: "to move very quickly" },
      { id: "ob-c", text: "to watch or notice carefully" },
      { id: "ob-d", text: "to forget something completely" },
    ],
  },
  {
    id: "word-04",
    word: "reluctant",
    definition: "not eager to act because you feel unsure or unwilling",
    spellingDefinition: "hesitant because you do not want to act",
    exampleSentences: [
      "Eli was reluctant to speak in front of the crowd.",
      "The cat seemed reluctant to step into the snow.",
      "I felt reluctant at first, but the new game was fun.",
    ],
    interestingFact:
      "Reluctant describes holding back even when someone may eventually agree.",
    definitionAttemptId: "efb3885e-b676-46a5-82db-5fcef67150a5",
    spellingAttemptId: "09f6b5ba-c7bf-4946-be67-6516328c5083",
    choices: [
      { id: "re-a", text: "very eager to begin" },
      { id: "re-b", text: "willing to take big risks" },
      { id: "re-c", text: "happy about a result" },
      { id: "re-d", text: "hesitant or unwilling to do something" },
    ],
  },
  {
    id: "word-05",
    word: "fortunate",
    definition: "having an outcome shaped by good luck",
    spellingDefinition: "having good results because of luck",
    exampleSentences: [
      "We were fortunate that the rain stopped before the picnic.",
      "The fortunate winner received two tickets to the game.",
      "Kai felt fortunate to have helpful neighbors.",
    ],
    interestingFact:
      "Fortunate is related to fortune, a word that can mean luck or chance.",
    definitionAttemptId: "07eebe5c-df58-4fc4-823a-9f83bf69072e",
    spellingAttemptId: "be833ca4-c5cf-43b6-871d-6f512ea94ff5",
    choices: [
      { id: "fo-a", text: "lucky or having good things happen" },
      { id: "fo-b", text: "doubtful or suspicious" },
      { id: "fo-c", text: "ordinary and not special" },
      { id: "fo-d", text: "easy to damage or break" },
    ],
  },
  {
    id: "word-06",
    word: "abundant",
    definition: "available in more than enough quantity",
    spellingDefinition: "present in a quantity greater than needed",
    exampleSentences: [
      "Wildflowers were abundant across the sunny field.",
      "After the harvest, the market had an abundant supply of apples.",
      "Rain is abundant in a tropical rainforest.",
    ],
    interestingFact:
      "Abundant shares a Latin root with a word meaning to overflow.",
    definitionAttemptId: "ecb55b4f-00e5-452d-b6ce-3abbbc37c9bf",
    spellingAttemptId: "c706d40f-1daa-4670-a334-d1469f1e5ec9",
    choices: [
      { id: "ab-a", text: "hidden from view" },
      { id: "ab-b", text: "present in a very large amount" },
      { id: "ab-c", text: "divided into equal pieces" },
      { id: "ab-d", text: "moving at a steady speed" },
    ],
  },
  {
    id: "word-07",
    word: "accomplish",
    definition: "to complete a goal through effort or skill",
    spellingDefinition: "to finish a goal successfully through effort",
    exampleSentences: [
      "Our class worked together to accomplish its reading goal.",
      "Jules practiced daily to accomplish the difficult climb.",
      "A checklist helped me accomplish every task before dinner.",
    ],
    interestingFact:
      "An accomplishment is something completed through effort or skill.",
    definitionAttemptId: "e5dd59b1-cf5e-4c73-abef-7536c9e12486",
    spellingAttemptId: "31665228-d13e-4c4b-8cf4-dd7d35c87627",
    choices: [
      { id: "ac-a", text: "to avoid making a decision" },
      { id: "ac-b", text: "to explain something in detail" },
      { id: "ac-c", text: "to successfully finish or achieve something" },
      { id: "ac-d", text: "to begin without a plan" },
    ],
  },
  {
    id: "word-08",
    word: "accurate",
    definition: "matching the facts without errors",
    spellingDefinition: "correct and free from errors",
    exampleSentences: [
      "The map gave an accurate picture of the hiking trail.",
      "Please use a ruler so your measurement is accurate.",
      "Her report was accurate because she checked every fact.",
    ],
    interestingFact:
      "Accurate information matches the facts as closely as possible.",
    definitionAttemptId: "505809cf-014a-48a0-8077-da8ccc12205e",
    spellingAttemptId: "3714b51a-f5b6-408e-af0e-887f913289e9",
    choices: [
      { id: "ak-a", text: "difficult to explain" },
      { id: "ak-b", text: "quickly changing" },
      { id: "ak-c", text: "made from several materials" },
      { id: "ak-d", text: "correct and free from mistakes" },
    ],
  },
  {
    id: "word-09",
    word: "adapt",
    definition: "to adjust so something works in a different situation",
    spellingDefinition: "to change so you fit a new situation",
    exampleSentences: [
      "Desert plants adapt to survive with very little water.",
      "We had to adapt our plans when the gym closed.",
      "The puppy quickly adapted to its new home.",
    ],
    interestingFact:
      "Living things may adapt over time, while people can adapt their plans right away.",
    definitionAttemptId: "81b518d8-97d1-4737-9866-754e4bdbf931",
    spellingAttemptId: "43125381-a654-415a-9c34-71b883f989e2",
    choices: [
      { id: "ad-a", text: "to change in order to fit new conditions" },
      { id: "ad-b", text: "to copy something exactly" },
      { id: "ad-c", text: "to remove every part" },
      { id: "ad-d", text: "to move in a straight line" },
    ],
  },
  {
    id: "word-10",
    word: "analyze",
    definition: "to study the parts of something to understand the whole",
    spellingDefinition: "to examine parts carefully to understand a whole",
    exampleSentences: [
      "The students analyze the chart before answering questions.",
      "We can analyze the clues to solve the mystery.",
      "Scientists analyze samples of soil in the lab.",
    ],
    interestingFact:
      "To analyze often means separating an idea into parts and studying how they connect.",
    definitionAttemptId: "127a864d-6975-4871-975b-44451a853673",
    spellingAttemptId: "73d551a1-9c09-469e-a5e3-a08a65af8901",
    choices: [
      { id: "an-a", text: "to make something more colorful" },
      { id: "an-b", text: "to examine something carefully in order to understand it" },
      { id: "an-c", text: "to trade one item for another" },
      { id: "an-d", text: "to repeat words from memory" },
    ],
  },
  {
    id: "word-11",
    word: "anticipate",
    definition: "to think ahead about what may happen and get ready",
    spellingDefinition: "to expect what may happen and prepare",
    exampleSentences: [
      "We anticipate heavy traffic, so we will leave early.",
      "The goalie tried to anticipate where the ball would go.",
      "Farmers anticipate cold weather by protecting young plants.",
    ],
    interestingFact:
      "Anticipate is related to a Latin word meaning to take care of something beforehand.",
    definitionAttemptId: "9752c7a3-919c-41f8-b388-30f94d9771d6",
    spellingAttemptId: "83804de2-9eac-4b26-a37f-2f9827bde665",
    choices: [
      { id: "at-a", text: "to remember an event from long ago" },
      { id: "at-b", text: "to discover something by accident" },
      { id: "at-c", text: "to expect something and prepare for it" },
      { id: "at-d", text: "to disagree in a respectful way" },
    ],
  },
  {
    id: "word-12",
    word: "conclude",
    definition: "to reach a decision from evidence or finish an activity",
    spellingDefinition: "to decide from evidence or bring something to an end",
    exampleSentences: [
      "From the tracks, we can conclude that a deer crossed the path.",
      "The speaker will conclude the program with a short poem.",
      "After comparing the evidence, Mina concluded that her guess was right.",
    ],
    interestingFact:
      "A conclusion can be the final part of a text or a decision based on evidence.",
    definitionAttemptId: "bc75df86-424d-4e2e-a7cb-2a7c9766f4a0",
    spellingAttemptId: "0dc7904a-47d2-4469-9165-8a5599a609ee",
    choices: [
      { id: "co-a", text: "to ask for more information" },
      { id: "co-b", text: "to organize things by size" },
      { id: "co-c", text: "to make a loud announcement" },
      { id: "co-d", text: "to decide after thinking or to bring something to an end" },
    ],
  },
  {
    id: "word-13",
    word: "contrast",
    definition: "to examine things by focusing on their differences",
    spellingDefinition: "to show how things differ from one another",
    exampleSentences: [
      "Contrast the two characters by describing their different choices.",
      "The white flowers contrast with the dark green leaves.",
      "Our report will compare and contrast city and country life.",
    ],
    interestingFact:
      "Contrast can be a verb for showing differences or a noun for the difference itself.",
    definitionAttemptId: "a3faa434-3f0a-415f-b2e4-98319cc1687c",
    spellingAttemptId: "fe110826-7bf5-4248-b01c-88a3d3918106",
    choices: [
      { id: "ct-a", text: "to show how two or more things are different" },
      { id: "ct-b", text: "to combine several ideas into one" },
      { id: "ct-c", text: "to put events in time order" },
      { id: "ct-d", text: "to make an object less heavy" },
    ],
  },
  {
    id: "word-14",
    word: "demonstrate",
    definition: "to make an idea clear by showing how it works",
    spellingDefinition: "to explain clearly by showing an example",
    exampleSentences: [
      "The coach will demonstrate how to hold the bat.",
      "Use the model to demonstrate how the planets move.",
      "Tariq demonstrated kindness by helping the new student.",
    ],
    interestingFact:
      "A demonstration helps an audience understand by letting them see an idea in action.",
    definitionAttemptId: "27c4a796-8077-4020-950f-0571a7530f48",
    spellingAttemptId: "f7a52ea6-95d3-4a8b-8d33-38738530c1be",
    choices: [
      { id: "de-a", text: "to hide the most important detail" },
      { id: "de-b", text: "to show or explain clearly by giving an example" },
      { id: "de-c", text: "to question whether something is true" },
      { id: "de-d", text: "to shorten a long journey" },
    ],
  },
  {
    id: "word-15",
    word: "essential",
    definition: "needed so much that something cannot work well without it",
    spellingDefinition: "so necessary that something cannot work without it",
    exampleSentences: [
      "Clean water is essential for good health.",
      "A helmet is essential safety gear for biking.",
      "Listening is an essential part of teamwork.",
    ],
    interestingFact:
      "The essential part of something is the part it cannot do without.",
    definitionAttemptId: "70f41db9-07af-4ba0-b2f4-7bd9edd589dd",
    spellingAttemptId: "429b4c08-abc1-46f4-8dff-a06a9f8136a1",
    choices: [
      { id: "es-a", text: "available only at night" },
      { id: "es-b", text: "interesting but not useful" },
      { id: "es-c", text: "completely necessary or extremely important" },
      { id: "es-d", text: "unusually difficult to carry" },
    ],
  },
  {
    id: "word-16",
    word: "expand",
    definition: "to grow in size, range, or amount of information",
    spellingDefinition: "to become larger or add more detail",
    exampleSentences: [
      "Warm air can expand and take up more space.",
      "Please expand your paragraph with another example.",
      "The library plans to expand its graphic novel section.",
    ],
    interestingFact:
      "Expand comes from a Latin word that means to spread out.",
    definitionAttemptId: "acd39bcf-1f93-4cf8-a26c-96f40e0c7483",
    spellingAttemptId: "a0df0848-32f3-4303-b627-62e3b1e9823e",
    choices: [
      { id: "ex-a", text: "to move something to a safer place" },
      { id: "ex-b", text: "to make a choice immediately" },
      { id: "ex-c", text: "to reduce the number of parts" },
      { id: "ex-d", text: "to become larger or to add more detail" },
    ],
  },
  {
    id: "word-17",
    word: "fragile",
    definition: "delicate enough to be damaged without much force",
    spellingDefinition: "easily damaged or broken",
    exampleSentences: [
      "The fragile glass ornament was wrapped in soft paper.",
      "A butterfly's wings are beautiful but fragile.",
      "The package had a label warning that its contents were fragile.",
    ],
    interestingFact:
      "Fragile comes from the same Latin root as fracture, a word for a break or crack.",
    definitionAttemptId: "69b7b768-d6f9-418b-baca-a1be40ef7f48",
    spellingAttemptId: "4a52f209-ba1e-4b9c-99b9-d4b946d8ecc0",
    choices: [
      { id: "fr-a", text: "easily broken, damaged, or harmed" },
      { id: "fr-b", text: "able to stretch very far" },
      { id: "fr-c", text: "covered with a rough surface" },
      { id: "fr-d", text: "built to last for many years" },
    ],
  },
  {
    id: "word-18",
    word: "predict",
    definition: "to use clues or evidence to tell what may happen next",
    spellingDefinition: "to say what is likely to happen using evidence",
    exampleSentences: [
      "Dark clouds helped us predict that rain was coming.",
      "Can you predict how the character will solve the problem?",
      "The scientist used data to predict the path of the storm.",
    ],
    interestingFact:
      "A prediction is strongest when it is supported by evidence rather than a random guess.",
    definitionAttemptId: "7720a616-e81f-465a-8caf-9a366f96a98f",
    spellingAttemptId: "f5becfc7-fa6e-463e-82a8-c07bd9433a17",
    choices: [
      { id: "pr-a", text: "to prove that an event already happened" },
      { id: "pr-b", text: "to say what is likely to happen in the future" },
      { id: "pr-c", text: "to describe something using a picture" },
      { id: "pr-d", text: "to change a rule after a vote" },
    ],
  },
  {
    id: "word-19",
    word: "scarce",
    definition: "available in such a small supply that it is difficult to get",
    spellingDefinition: "hard to obtain because too little is available",
    exampleSentences: [
      "Fresh water is scarce in some dry regions.",
      "Tickets became scarce as the concert date approached.",
      "Food was scarce for the animals during the long winter.",
    ],
    interestingFact:
      "Scarce describes a limited supply, while rare often describes something unusual.",
    definitionAttemptId: "97a0e295-2e0d-4b20-89f9-0c53cbfa55fb",
    spellingAttemptId: "d441e231-f038-4cb3-9f20-ec2ece781096",
    choices: [
      { id: "sc-a", text: "easy to replace with something else" },
      { id: "sc-b", text: "stored in a neat and safe way" },
      { id: "sc-c", text: "hard to find because there is not enough" },
      { id: "sc-d", text: "shared equally among a group" },
    ],
  },
  {
    id: "word-20",
    word: "transform",
    definition: "to become very different in shape, form, or appearance",
    spellingDefinition: "to change greatly in form or appearance",
    exampleSentences: [
      "A caterpillar will transform into a butterfly.",
      "Paint and new lights transformed the old room.",
      "Heat can transform ice into liquid water.",
    ],
    interestingFact:
      "The prefix trans- can mean across or beyond, and form refers to shape.",
    definitionAttemptId: "d0a7dd50-8c2e-4ae6-a9ae-faaec6a040a2",
    spellingAttemptId: "6e818c9f-0d49-4e6c-be58-14e0304b7089",
    choices: [
      { id: "tr-a", text: "to protect something from change" },
      { id: "tr-b", text: "to compare two equal amounts" },
      { id: "tr-c", text: "to return an object to its owner" },
      { id: "tr-d", text: "to change completely in form or appearance" },
    ],
  },
];

const FIXTURE_WORD_LISTS: Record<string, VocabularyWord[]> = {
  word_list_id: WORD_LIST,
};

/**
 * Canonical server-only fixture. Browser code receives only narrow projections
 * from the Vocabulary content endpoint.
 */
export function getWordList(wordListId: string): VocabularyWord[] | null {
  return FIXTURE_WORD_LISTS[wordListId] ?? null;
}

/**
 * Resolves an opaque spelling speech reference (the spelling attempt ID) to
 * its canonical word record. Only the server-side speech boundary may use
 * this; the resolved word must never be written into a browser response.
 */
export function findVocabularySpellingWord(
  reference: string
): VocabularyWord | null {
  for (const words of Object.values(FIXTURE_WORD_LISTS)) {
    const word = words.find(
      (candidate) => candidate.spellingAttemptId === reference
    );
    if (word) {
      return word;
    }
  }
  return null;
}
