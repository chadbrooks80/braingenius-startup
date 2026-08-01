import "server-only";

import { createHash } from "node:crypto";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import {
  applyVocabularyAnswerTransition,
  buildVocabularyPanelProjection,
  isVocabularyLearningComplete,
  selectDueVocabularyReviews,
  selectNextVocabularyCheckpointGroup,
  selectVocabularyActiveFive,
  type VocabularyAttemptType,
  type VocabularyProgressRow,
  type VocabularyReviewStage,
} from "../state/vocabularyProgressProjection";
import type {
  VocabularyPanelSnapshot,
  VocabularyProgressSnapshot,
} from "../data/vocabularyContentTypes";

export type { VocabularyPanelSnapshot, VocabularyProgressSnapshot };

// Module-owned durable repository for `ModVocabLearning`/`ModVocabWordProgress`/
// `ModVocabSession`/`ModVocabAttempt`/`ModVocabAttemptChoice`/
// `ModVocabDailyPractice`. Owns every write required by the persistence
// feature's database-update matrix; grading and mastery/review math itself
// lives in the pure `vocabularyProgressProjection.ts` module so it is
// testable without a database. A narrow injectable `VocabularyLearningStoreDb`
// interface (not the raw Prisma client) mirrors the existing
// `vocabularyListStore.ts`/`ttsUsageService` convention so tests can supply a
// deterministic in-memory double instead of a real database.

const PANEL_WORD_ID_NAMESPACE = "vocabulary-panel-word-projection-v1";

/** Opaque, session-stable display ID so panel rows never leak canonical list-word IDs. */
export function deriveVocabularyPanelWordId(
  sessionId: string,
  listWordId: string
): string {
  const digest = createHash("sha256")
    .update(`${PANEL_WORD_ID_NAMESPACE}:${sessionId}:${listWordId}`)
    .digest("hex");
  return `panel-${digest.slice(0, 24)}`;
}

export type VocabularyLearningAuthorization = {
  learningId: string;
  listId: string;
};

type LearningRow = {
  id: string;
  listId: string;
  learnerUserId: string;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  gradedAnswerCount: number;
  correctAnswerCount: number;
  incorrectAnswerCount: number;
  servedCheckpointGroupCount: number;
};

async function findLearningRow(
  client: Prisma.TransactionClient | typeof prisma,
  learningId: string
): Promise<LearningRow | null> {
  return client.modVocabLearning.findUnique({
    where: { id: learningId },
    select: {
      id: true,
      listId: true,
      learnerUserId: true,
      status: true,
      gradedAnswerCount: true,
      correctAnswerCount: true,
      incorrectAnswerCount: true,
      servedCheckpointGroupCount: true,
    },
  });
}

/**
 * Authorizes the caller for `learningId`. Returns null for missing, another
 * learner's, and archived learnings alike so callers present one identical
 * safe not-found result. Ownership of the underlying `ModVocabList` is
 * deliberately not required: a teacher/parent may own the reusable list
 * while a different learner holds an independent learning record.
 */
export async function authorizeVocabularyLearning(
  learnerUserId: string,
  learningId: string
): Promise<VocabularyLearningAuthorization | null> {
  const learning = await findLearningRow(prisma, learningId);
  if (
    !learning ||
    learning.learnerUserId !== learnerUserId ||
    learning.status === "ARCHIVED"
  ) {
    return null;
  }
  return { learningId: learning.id, listId: learning.listId };
}

async function loadProgressRows(
  client: Prisma.TransactionClient | typeof prisma,
  learningId: string
): Promise<VocabularyProgressRow[]> {
  const rows = await client.modVocabWordProgress.findMany({
    where: { learningId },
    select: {
      listWordId: true,
      introduced: true,
      definitionConsecutiveCorrect: true,
      definitionMastered: true,
      spellingConsecutiveCorrect: true,
      spellingMastered: true,
      practicePresentationCount: true,
      reviewStage: true,
      nextReviewQuestionNumber: true,
      totalCorrect: true,
      totalIncorrect: true,
      initialMasterySequence: true,
      listWord: { select: { position: true } },
    },
  });
  return rows.map((row) => ({
    listWordId: row.listWordId,
    position: row.listWord.position,
    introduced: row.introduced,
    definitionConsecutiveCorrect: row.definitionConsecutiveCorrect,
    definitionMastered: row.definitionMastered,
    spellingConsecutiveCorrect: row.spellingConsecutiveCorrect,
    spellingMastered: row.spellingMastered,
    practicePresentationCount: row.practicePresentationCount,
    reviewStage: row.reviewStage as VocabularyReviewStage,
    nextReviewQuestionNumber: row.nextReviewQuestionNumber,
    totalCorrect: row.totalCorrect,
    totalIncorrect: row.totalIncorrect,
    initialMasterySequence: row.initialMasterySequence,
  }));
}

async function buildPanelSnapshot(
  client: Prisma.TransactionClient | typeof prisma,
  sessionId: string,
  rows: readonly VocabularyProgressRow[]
): Promise<VocabularyPanelSnapshot> {
  const projection = buildVocabularyPanelProjection(rows);
  const neededIds = [
    ...new Set(
      [...projection.wordList, ...projection.spellingWords, ...projection.masteredWords].map(
        (row) => row.listWordId
      )
    ),
  ];
  const words =
    neededIds.length === 0
      ? []
      : await client.modVocabListWord.findMany({
          where: { id: { in: neededIds } },
          select: { id: true, word: true },
        });
  const textById = new Map(words.map((word) => [word.id, word.word]));

  const toDisplay = (
    row: VocabularyProgressRow
  ): VocabularyPanelSnapshot["wordList"][number] => ({
    id: deriveVocabularyPanelWordId(sessionId, row.listWordId),
    word: textById.get(row.listWordId) ?? "",
  });

  return {
    wordList: projection.wordList.map(toDisplay),
    spellingWords: projection.spellingWords.map((row) => ({
      id: deriveVocabularyPanelWordId(sessionId, row.listWordId),
    })),
    masteredWords: projection.masteredWords.map(toDisplay),
  };
}

async function buildProgressSnapshot(
  client: Prisma.TransactionClient | typeof prisma,
  learning: LearningRow,
  sessionId: string,
  stateVersion: number,
  rows: readonly VocabularyProgressRow[]
): Promise<VocabularyProgressSnapshot> {
  return {
    learningStatus: learning.status === "COMPLETED" ? "COMPLETED" : "ACTIVE",
    gradedAnswerCount: learning.gradedAnswerCount,
    correctAnswerCount: learning.correctAnswerCount,
    incorrectAnswerCount: learning.incorrectAnswerCount,
    stateVersion,
    panel: await buildPanelSnapshot(client, sessionId, rows),
  };
}

export type VocabularyLearningSession = {
  learningId: string;
  listId: string;
  sessionId: string;
  totalWordCount: number;
  progress: VocabularyProgressSnapshot;
  dueReviewListWordIds: string[];
  activeFiveListWordIds: string[];
  servedCheckpointGroupCount: number;
  // Lightweight progress rows for every current list word, so the caller can
  // hydrate the in-process lesson sequencer (active pool, review schedule,
  // checkpoint order) without a second database round trip.
  progressRows: VocabularyProgressRow[];
};

/**
 * Opens one durable Vocabulary visit: ensures every current list word has a
 * progress row (without overwriting existing progress), safely ends any
 * prior active session/attempts for this learning, and starts a fresh
 * session. Returns the full authoritative projection needed to hydrate the
 * lesson and publish the initial panel snapshot.
 */
export async function initializeVocabularyLearning(
  learnerUserId: string,
  learningId: string
): Promise<VocabularyLearningSession | null> {
  const authorization = await authorizeVocabularyLearning(learnerUserId, learningId);
  if (!authorization) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const learning = await findLearningRow(tx, learningId);
    if (!learning) {
      return null;
    }

    const listWords = await tx.modVocabListWord.findMany({
      where: { listId: authorization.listId },
      select: { id: true },
    });

    if (listWords.length > 0) {
      await tx.modVocabWordProgress.createMany({
        data: listWords.map((word) => ({
          learningId,
          listWordId: word.id,
        })),
        skipDuplicates: true,
      });
    }

    const priorActiveSessions = await tx.modVocabSession.findMany({
      where: { learningId, status: "ACTIVE" },
      select: { id: true },
    });
    if (priorActiveSessions.length > 0) {
      const priorSessionIds = priorActiveSessions.map((session) => session.id);
      await tx.modVocabAttempt.updateMany({
        where: { sessionId: { in: priorSessionIds }, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
      await tx.modVocabSession.updateMany({
        where: { id: { in: priorSessionIds } },
        data: { status: "ENDED", endedAt: new Date() },
      });
    }

    const session = await tx.modVocabSession.create({
      data: { learningId },
      select: { id: true, stateVersion: true },
    });

    const rows = await loadProgressRows(tx, learningId);
    const progress = await buildProgressSnapshot(
      tx,
      learning,
      session.id,
      session.stateVersion,
      rows
    );

    return {
      learningId,
      listId: authorization.listId,
      sessionId: session.id,
      totalWordCount: listWords.length,
      progress,
      dueReviewListWordIds: selectDueVocabularyReviews(
        rows,
        learning.gradedAnswerCount
      ).map((row) => row.listWordId),
      activeFiveListWordIds: selectVocabularyActiveFive(rows).map(
        (row) => row.listWordId
      ),
      servedCheckpointGroupCount: learning.servedCheckpointGroupCount,
      progressRows: rows,
    };
  });
}

/** Marks one word's introduction complete on its first completion only. */
export async function markVocabularyWordIntroduced(
  learningId: string,
  sessionId: string,
  listWordId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.modVocabWordProgress.updateMany({
      where: { learningId, listWordId, introduced: false },
      data: { introduced: true, introducedAt: new Date() },
    });
    if (updated.count > 0) {
      await tx.modVocabSession.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date(), stateVersion: { increment: 1 } },
      });
    }
  });
}

export type VocabularyDefinitionChoiceInput = {
  sourceListWordId: string | null;
  position: number;
  textSnapshot: string;
  isCorrect: boolean;
};

/** Creates a durable ACTIVE definition attempt with its offered choices before content is returned. */
export async function createVocabularyDefinitionAttempt(
  learningId: string,
  sessionId: string,
  listWordId: string,
  review: boolean,
  choices: readonly VocabularyDefinitionChoiceInput[]
): Promise<{ attemptId: string; choices: Array<{ id: string; position: number }> }> {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.modVocabAttempt.create({
      data: {
        sessionId,
        listWordId,
        answerType: "DEFINITION",
        status: "ACTIVE",
        review,
      },
      select: { id: true },
    });

    const createdChoices = await Promise.all(
      choices.map((choice) =>
        tx.modVocabAttemptChoice.create({
          data: {
            attemptId: attempt.id,
            sourceListWordId: choice.sourceListWordId,
            position: choice.position,
            textSnapshot: choice.textSnapshot,
            isCorrect: choice.isCorrect,
          },
          select: { id: true, position: true },
        })
      )
    );

    if (!review) {
      await tx.modVocabWordProgress.updateMany({
        where: { learningId, listWordId },
        data: { practicePresentationCount: { increment: 1 } },
      });
    }
    await tx.modVocabSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date(), stateVersion: { increment: 1 } },
    });

    return { attemptId: attempt.id, choices: createdChoices };
  });
}

/** Creates a durable ACTIVE spelling attempt before content is returned. */
export async function createVocabularySpellingAttempt(
  learningId: string,
  sessionId: string,
  listWordId: string,
  review: boolean,
  canonicalSpelling: string
): Promise<{ attemptId: string }> {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.modVocabAttempt.create({
      data: {
        sessionId,
        listWordId,
        answerType: "SPELLING",
        status: "ACTIVE",
        review,
        correctAnswerSnapshot: canonicalSpelling,
      },
      select: { id: true },
    });

    if (!review) {
      await tx.modVocabWordProgress.updateMany({
        where: { learningId, listWordId },
        data: { practicePresentationCount: { increment: 1 } },
      });
    }
    await tx.modVocabSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date(), stateVersion: { increment: 1 } },
    });

    return { attemptId: attempt.id };
  });
}

/** Resolves the canonical spelling/definition snapshot for the protected TTS boundary. Server-only. */
export async function findVocabularySpellingAttemptForSpeech(
  learnerUserId: string,
  attemptId: string
): Promise<{ canonicalSpelling: string; speechDefinition: string } | null> {
  const attempt = await prisma.modVocabAttempt.findUnique({
    where: { id: attemptId },
    select: {
      status: true,
      answerType: true,
      correctAnswerSnapshot: true,
      listWord: { select: { definition: true } },
      session: { select: { learning: { select: { learnerUserId: true } } } },
    },
  });
  if (
    !attempt ||
    attempt.status !== "ACTIVE" ||
    attempt.answerType !== "SPELLING" ||
    attempt.session.learning.learnerUserId !== learnerUserId ||
    !attempt.correctAnswerSnapshot ||
    !attempt.listWord.definition
  ) {
    return null;
  }
  return {
    canonicalSpelling: attempt.correctAnswerSnapshot,
    speechDefinition: attempt.listWord.definition,
  };
}

export type VocabularyDefinitionSubmission = {
  answerType: "DEFINITION";
  attemptId: string;
  selectedChoiceId: string;
};
export type VocabularySpellingSubmission = {
  answerType: "SPELLING";
  attemptId: string;
  answer: string;
};
export type VocabularyAnswerSubmissionInput =
  | VocabularyDefinitionSubmission
  | VocabularySpellingSubmission;

export type VocabularyCommitResult =
  | { status: "invalid" }
  | { status: "rejected-modified-retry" }
  | {
      status: "ok";
      correct: boolean;
      correctChoiceId: string | null;
      correctAnswer: string | null;
      progress: VocabularyProgressSnapshot;
    };

function normalizeSpelling(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function submittedAnswerValue(submission: VocabularyAnswerSubmissionInput): string {
  return submission.answerType === "DEFINITION"
    ? submission.selectedChoiceId
    : normalizeSpelling(submission.answer);
}

/**
 * Grades and durably commits exactly one newly answered attempt: updates the
 * attempt, word progress, learning counters, session counters, and daily
 * totals together in one transaction, then returns the authoritative
 * progress/panel projection. An exact-duplicate submission for an
 * already-answered attempt replays its stored result without changing any
 * counter again; a modified duplicate is rejected.
 */
export async function commitVocabularyAnswer(
  learnerUserId: string,
  submission: VocabularyAnswerSubmissionInput
): Promise<VocabularyCommitResult> {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.modVocabAttempt.findUnique({
      where: { id: submission.attemptId },
      select: {
        id: true,
        sessionId: true,
        listWordId: true,
        answerType: true,
        status: true,
        review: true,
        submittedAnswer: true,
        wasCorrect: true,
        correctAnswerSnapshot: true,
        choices: { select: { id: true, isCorrect: true } },
        session: {
          select: {
            learningId: true,
            stateVersion: true,
            learning: { select: { learnerUserId: true } },
          },
        },
      },
    });

    if (
      !attempt ||
      attempt.session.learning.learnerUserId !== learnerUserId ||
      (attempt.answerType === "DEFINITION") !== (submission.answerType === "DEFINITION")
    ) {
      return { status: "invalid" };
    }

    const submittedValue = submittedAnswerValue(submission);

    if (attempt.status === "ANSWERED") {
      if (attempt.submittedAnswer !== submittedValue) {
        return { status: "rejected-modified-retry" };
      }
      const learning = await findLearningRow(tx, attempt.session.learningId);
      if (!learning) {
        return { status: "invalid" };
      }
      const rows = await loadProgressRows(tx, attempt.session.learningId);
      const correctChoiceId =
        attempt.answerType === "DEFINITION"
          ? attempt.choices.find((choice) => choice.isCorrect)?.id ?? null
          : null;
      return {
        status: "ok",
        correct: attempt.wasCorrect ?? false,
        correctChoiceId,
        correctAnswer:
          attempt.answerType === "SPELLING" && !attempt.wasCorrect
            ? attempt.correctAnswerSnapshot
            : null,
        progress: await buildProgressSnapshot(
          tx,
          learning,
          attempt.sessionId,
          attempt.session.stateVersion,
          rows
        ),
      };
    }

    if (attempt.status !== "ACTIVE") {
      return { status: "invalid" };
    }

    let correct: boolean;
    let correctChoiceId: string | null = null;
    let correctAnswer: string | null = null;

    if (submission.answerType === "DEFINITION") {
      const selected = attempt.choices.find((choice) => choice.id === submission.selectedChoiceId);
      if (!selected) {
        return { status: "invalid" };
      }
      correct = selected.isCorrect;
      correctChoiceId = attempt.choices.find((choice) => choice.isCorrect)?.id ?? null;
    } else {
      if (!attempt.correctAnswerSnapshot) {
        return { status: "invalid" };
      }
      correct = submittedValue === normalizeSpelling(attempt.correctAnswerSnapshot);
      correctAnswer = correct ? null : attempt.correctAnswerSnapshot;
    }

    const learning = await findLearningRow(tx, attempt.session.learningId);
    if (!learning) {
      return { status: "invalid" };
    }

    const currentProgress = await tx.modVocabWordProgress.findUnique({
      where: {
        learningId_listWordId: {
          learningId: attempt.session.learningId,
          listWordId: attempt.listWordId,
        },
      },
    });
    if (!currentProgress) {
      return { status: "invalid" };
    }

    const gradedAnswerCountAfter = learning.gradedAnswerCount + 1;
    const transition = applyVocabularyAnswerTransition({
      progress: {
        listWordId: currentProgress.listWordId,
        position: 0,
        introduced: currentProgress.introduced,
        definitionConsecutiveCorrect: currentProgress.definitionConsecutiveCorrect,
        definitionMastered: currentProgress.definitionMastered,
        spellingConsecutiveCorrect: currentProgress.spellingConsecutiveCorrect,
        spellingMastered: currentProgress.spellingMastered,
        practicePresentationCount: currentProgress.practicePresentationCount,
        reviewStage: currentProgress.reviewStage as VocabularyReviewStage,
        nextReviewQuestionNumber: currentProgress.nextReviewQuestionNumber,
        totalCorrect: currentProgress.totalCorrect,
        totalIncorrect: currentProgress.totalIncorrect,
        initialMasterySequence: currentProgress.initialMasterySequence,
      },
      answerType: attempt.answerType as VocabularyAttemptType,
      review: attempt.review,
      correct,
      gradedAnswerCountAfter,
    });

    let initialMasterySequence = transition.progress.initialMasterySequence;
    const now = new Date();
    if (transition.firstSpellingMasteryNow) {
      const masteredCount = await tx.modVocabWordProgress.count({
        where: { learningId: attempt.session.learningId, initialMasterySequence: { not: null } },
      });
      initialMasterySequence = masteredCount + 1;
    }

    await tx.modVocabAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "ANSWERED",
        submittedAnswer: submittedValue,
        wasCorrect: correct,
        answeredAt: now,
      },
    });

    await tx.modVocabWordProgress.update({
      where: { id: currentProgress.id },
      data: {
        definitionConsecutiveCorrect: transition.progress.definitionConsecutiveCorrect,
        definitionMastered: transition.progress.definitionMastered,
        definitionMasteredAt: transition.progress.definitionMastered
          ? currentProgress.definitionMasteredAt ?? now
          : currentProgress.definitionMasteredAt,
        spellingConsecutiveCorrect: transition.progress.spellingConsecutiveCorrect,
        spellingMastered: transition.progress.spellingMastered,
        spellingMasteredAt: transition.progress.spellingMastered
          ? currentProgress.spellingMasteredAt ?? now
          : currentProgress.spellingMasteredAt,
        reviewStage: transition.progress.reviewStage,
        nextReviewQuestionNumber: transition.progress.nextReviewQuestionNumber,
        totalCorrect: transition.progress.totalCorrect,
        totalIncorrect: transition.progress.totalIncorrect,
        initialMasterySequence,
        firstMasteredAt: transition.firstSpellingMasteryNow
          ? now
          : currentProgress.firstMasteredAt,
      },
    });

    const updatedLearning = await tx.modVocabLearning.update({
      where: { id: learning.id },
      data: {
        gradedAnswerCount: { increment: 1 },
        correctAnswerCount: correct ? { increment: 1 } : undefined,
        incorrectAnswerCount: !correct ? { increment: 1 } : undefined,
      },
      select: {
        id: true,
        listId: true,
        learnerUserId: true,
        status: true,
        gradedAnswerCount: true,
        correctAnswerCount: true,
        incorrectAnswerCount: true,
        servedCheckpointGroupCount: true,
      },
    });

    const session = await tx.modVocabSession.update({
      where: { id: attempt.sessionId },
      data: {
        gradedAnswerCount: { increment: 1 },
        correctAnswerCount: correct ? { increment: 1 } : undefined,
        incorrectAnswerCount: !correct ? { increment: 1 } : undefined,
        lastActivityAt: now,
        stateVersion: { increment: 1 },
      },
      select: { id: true, stateVersion: true },
    });

    const practiceDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    await tx.modVocabDailyPractice.upsert({
      where: { learnerUserId_practiceDate: { learnerUserId, practiceDate } },
      create: {
        learnerUserId,
        practiceDate,
        questionsAnswered: 1,
        correctAnswers: correct ? 1 : 0,
      },
      update: {
        questionsAnswered: { increment: 1 },
        correctAnswers: correct ? { increment: 1 } : undefined,
      },
    });

    const rows = await loadProgressRows(tx, attempt.session.learningId);
    const totalWordCount = await tx.modVocabListWord.count({
      where: { listId: updatedLearning.listId },
    });
    let finalLearning = updatedLearning;
    if (
      updatedLearning.status !== "COMPLETED" &&
      isVocabularyLearningComplete(
        rows,
        totalWordCount,
        updatedLearning.gradedAnswerCount,
        updatedLearning.servedCheckpointGroupCount
      )
    ) {
      finalLearning = await tx.modVocabLearning.update({
        where: { id: updatedLearning.id },
        data: { status: "COMPLETED", completedAt: now },
        select: {
          id: true,
          listId: true,
          learnerUserId: true,
          status: true,
          gradedAnswerCount: true,
          correctAnswerCount: true,
          incorrectAnswerCount: true,
          servedCheckpointGroupCount: true,
        },
      });
      await tx.modVocabSession.update({
        where: { id: session.id },
        data: { status: "ENDED", endedAt: now },
      });
    }

    return {
      status: "ok",
      correct,
      correctChoiceId,
      correctAnswer,
      progress: await buildProgressSnapshot(
        tx,
        finalLearning,
        session.id,
        session.stateVersion,
        rows
      ),
    };
  });
}

/**
 * Serves the next earned-but-unserved Word Search checkpoint group exactly
 * once. Replaying the same authorized checkpoint capability after it has
 * already been served returns null instead of re-incrementing the counter.
 */
export async function serveNextVocabularyCheckpointGroup(
  learningId: string
): Promise<string[] | null> {
  return prisma.$transaction(async (tx) => {
    const learning = await findLearningRow(tx, learningId);
    if (!learning) {
      return null;
    }
    const rows = await loadProgressRows(tx, learningId);
    const nextGroup = selectNextVocabularyCheckpointGroup(
      rows,
      learning.servedCheckpointGroupCount
    );
    if (!nextGroup) {
      return null;
    }
    await tx.modVocabLearning.update({
      where: { id: learningId },
      data: { servedCheckpointGroupCount: { increment: 1 } },
    });
    return nextGroup;
  });
}
