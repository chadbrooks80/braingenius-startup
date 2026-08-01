import {
  ACTIVE_POOL_SIZE,
  DEFINITION_MASTERY_STREAK,
  DELAYED_REVIEW_ANSWER_COUNT,
  SPELLING_MASTERY_STREAK,
  WORD_SEARCH_CHECKPOINT_GROUP_SIZE,
} from "./VocabularyLessonTypes";

// Pure, database-shape projection and transition rules shared by the durable
// Vocabulary learning store and its unit tests. Nothing here touches Prisma
// or any I/O so the full mastery/review/checkpoint/panel matrix is testable
// without a database. `vocabularyLearningStore.ts` is the only caller that
// combines this with persistence.

export type VocabularyReviewStage = "IDLE" | "DEFINITION_PENDING" | "SPELLING_PENDING";
export type VocabularyAttemptType = "DEFINITION" | "SPELLING";

export type VocabularyProgressRow = {
  listWordId: string;
  position: number;
  introduced: boolean;
  definitionConsecutiveCorrect: number;
  definitionMastered: boolean;
  spellingConsecutiveCorrect: number;
  spellingMastered: boolean;
  practicePresentationCount: number;
  reviewStage: VocabularyReviewStage;
  nextReviewQuestionNumber: number | null;
  totalCorrect: number;
  totalIncorrect: number;
  initialMasterySequence: number | null;
};

export function createDefaultVocabularyProgressRow(
  listWordId: string,
  position: number
): VocabularyProgressRow {
  return {
    listWordId,
    position,
    introduced: false,
    definitionConsecutiveCorrect: 0,
    definitionMastered: false,
    spellingConsecutiveCorrect: 0,
    spellingMastered: false,
    practicePresentationCount: 0,
    reviewStage: "IDLE",
    nextReviewQuestionNumber: null,
    totalCorrect: 0,
    totalIncorrect: 0,
    initialMasterySequence: null,
  };
}

/** The first ACTIVE_POOL_SIZE currently unfinished words, ordered by position. */
export function selectVocabularyActiveFive(
  rows: readonly VocabularyProgressRow[]
): VocabularyProgressRow[] {
  return [...rows]
    .filter((row) => !row.spellingMastered)
    .sort((left, right) => left.position - right.position)
    .slice(0, ACTIVE_POOL_SIZE);
}

export type VocabularyPanelProjection = {
  wordList: VocabularyProgressRow[];
  spellingWords: VocabularyProgressRow[];
  masteredWords: VocabularyProgressRow[];
};

export function buildVocabularyPanelProjection(
  rows: readonly VocabularyProgressRow[]
): VocabularyPanelProjection {
  const activeFive = new Set(
    selectVocabularyActiveFive(rows).map((row) => row.listWordId)
  );
  const byPosition = (left: VocabularyProgressRow, right: VocabularyProgressRow) =>
    left.position - right.position;

  const wordList = rows
    .filter(
      (row) =>
        activeFive.has(row.listWordId) &&
        !row.definitionMastered &&
        !row.spellingMastered
    )
    .sort(byPosition);
  const spellingWords = rows
    .filter(
      (row) =>
        activeFive.has(row.listWordId) &&
        row.definitionMastered &&
        !row.spellingMastered
    )
    .sort(byPosition);
  const masteredWords = rows.filter((row) => row.spellingMastered).sort(byPosition);

  return { wordList, spellingWords, masteredWords };
}

/** Reviews currently due, ordered by due question number then position. */
export function selectDueVocabularyReviews(
  rows: readonly VocabularyProgressRow[],
  gradedAnswerCount: number
): VocabularyProgressRow[] {
  return rows
    .filter(
      (row) =>
        row.nextReviewQuestionNumber !== null &&
        row.nextReviewQuestionNumber <= gradedAnswerCount
    )
    .sort(
      (left, right) =>
        (left.nextReviewQuestionNumber ?? 0) - (right.nextReviewQuestionNumber ?? 0) ||
        left.position - right.position
    );
}

/**
 * The next earned-but-unserved Word Search checkpoint group, derived purely
 * from first-mastery order and how many groups have already been served.
 * Returns null when no new group has been earned yet.
 */
export function selectNextVocabularyCheckpointGroup(
  rows: readonly VocabularyProgressRow[],
  servedCheckpointGroupCount: number
): string[] | null {
  const masteredInOrder = rows
    .filter((row) => row.initialMasterySequence !== null)
    .sort((left, right) => (left.initialMasterySequence ?? 0) - (right.initialMasterySequence ?? 0));

  const completedGroups = Math.floor(
    masteredInOrder.length / WORD_SEARCH_CHECKPOINT_GROUP_SIZE
  );
  if (completedGroups <= servedCheckpointGroupCount) {
    return null;
  }

  const start = servedCheckpointGroupCount * WORD_SEARCH_CHECKPOINT_GROUP_SIZE;
  return masteredInOrder
    .slice(start, start + WORD_SEARCH_CHECKPOINT_GROUP_SIZE)
    .map((row) => row.listWordId);
}

export function isVocabularyLearningComplete(
  rows: readonly VocabularyProgressRow[],
  totalWordCount: number,
  gradedAnswerCount: number,
  servedCheckpointGroupCount: number
): boolean {
  if (rows.length < totalWordCount) {
    return false;
  }
  if (selectVocabularyActiveFive(rows).length > 0) {
    return false;
  }
  if (selectDueVocabularyReviews(rows, gradedAnswerCount).length > 0) {
    return false;
  }
  if (rows.some((row) => row.reviewStage !== "IDLE")) {
    return false;
  }
  if (selectNextVocabularyCheckpointGroup(rows, servedCheckpointGroupCount) !== null) {
    return false;
  }
  return true;
}

export type VocabularyAnswerTransitionInput = {
  progress: VocabularyProgressRow;
  answerType: VocabularyAttemptType;
  review: boolean;
  correct: boolean;
  // ModVocabLearning.gradedAnswerCount after this answer has been counted.
  gradedAnswerCountAfter: number;
};

export type VocabularyAnswerTransitionResult = {
  progress: VocabularyProgressRow;
  // True exactly when this answer is the first time this word reaches full
  // spelling mastery (initialMasterySequence must be newly assigned).
  firstSpellingMasteryNow: boolean;
};

/**
 * Applies exactly one graded definition/spelling answer to one word's
 * progress row, following the ordinary-practice and review rules. Pure: the
 * caller owns assigning `initialMasterySequence`/`firstMasteredAt` (which
 * requires a durable, monotonic sequence) and persisting the result.
 */
export function applyVocabularyAnswerTransition(
  input: VocabularyAnswerTransitionInput
): VocabularyAnswerTransitionResult {
  const progress: VocabularyProgressRow = { ...input.progress };

  if (input.review) {
    if (!input.correct) {
      progress.definitionConsecutiveCorrect = 0;
      progress.definitionMastered = false;
      progress.spellingConsecutiveCorrect = 0;
      progress.spellingMastered = false;
      progress.reviewStage = "IDLE";
      progress.nextReviewQuestionNumber = null;
      progress.totalIncorrect += 1;
      return { progress, firstSpellingMasteryNow: false };
    }

    progress.totalCorrect += 1;
    if (input.answerType === "DEFINITION") {
      progress.reviewStage = "SPELLING_PENDING";
      return { progress, firstSpellingMasteryNow: false };
    }

    progress.reviewStage = "IDLE";
    progress.nextReviewQuestionNumber =
      input.gradedAnswerCountAfter + DELAYED_REVIEW_ANSWER_COUNT;
    return { progress, firstSpellingMasteryNow: false };
  }

  if (input.answerType === "DEFINITION") {
    if (input.correct) {
      progress.definitionConsecutiveCorrect += 1;
      progress.totalCorrect += 1;
      if (progress.definitionConsecutiveCorrect >= DEFINITION_MASTERY_STREAK) {
        progress.definitionMastered = true;
      }
    } else {
      progress.definitionConsecutiveCorrect = 0;
      progress.totalIncorrect += 1;
    }
    return { progress, firstSpellingMasteryNow: false };
  }

  // Ordinary spelling practice.
  if (!input.correct) {
    progress.spellingConsecutiveCorrect = 0;
    progress.totalIncorrect += 1;
    return { progress, firstSpellingMasteryNow: false };
  }

  progress.spellingConsecutiveCorrect += 1;
  progress.totalCorrect += 1;
  let firstSpellingMasteryNow = false;
  if (
    progress.spellingConsecutiveCorrect >= SPELLING_MASTERY_STREAK &&
    !progress.spellingMastered
  ) {
    progress.spellingMastered = true;
    progress.reviewStage = "IDLE";
    progress.nextReviewQuestionNumber =
      input.gradedAnswerCountAfter + DELAYED_REVIEW_ANSWER_COUNT;
    firstSpellingMasteryNow = progress.initialMasterySequence === null;
  }
  return { progress, firstSpellingMasteryNow };
}
