import { randomUUID } from "node:crypto";
import {
  applyVocabularyAnswerTransition,
  createDefaultVocabularyProgressRow,
  isVocabularyLearningComplete,
  selectNextVocabularyCheckpointGroup,
  type VocabularyProgressRow,
} from "../../src/learning-modules/vocabulary/state/vocabularyProgressProjection";
import type {
  VocabularyLearningSource,
} from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import type {
  VocabularyCommitResult,
  VocabularyLearningSession,
  VocabularyPanelSnapshot,
  VocabularyProgressSnapshot,
} from "../../src/learning-modules/vocabulary/server/vocabularyLearningStore";
import type { VocabularyDefinitionChoiceInput } from "../../src/learning-modules/vocabulary/server/vocabularyLearningStore";

// Deterministic in-memory double for `vocabularyLearningStore.ts`, mirroring
// the real Prisma-backed transaction semantics (session expiry, exact-once
// idempotent grading, checkpoint counters, completion) using the same pure
// `vocabularyProgressProjection.ts` rules the real repository uses, so tests
// never contact a real database. Matches the existing
// `fakeVocabularyListStore.ts`/`ttsUsageService` fake-store convention.

export type FakeVocabularyLearning = {
  learningId: string;
  listId: string;
  learnerUserId: string;
  status?: "ACTIVE" | "COMPLETED" | "ARCHIVED";
};

export type FakeVocabularyListWordSeed = {
  listId: string;
  id: string;
  position: number;
  word: string;
  definition?: string | null;
};

type Session = {
  id: string;
  learningId: string;
  status: "ACTIVE" | "ENDED";
  stateVersion: number;
};

type Attempt = {
  id: string;
  sessionId: string;
  listWordId: string;
  answerType: "DEFINITION" | "SPELLING";
  status: "ACTIVE" | "ANSWERED" | "EXPIRED";
  review: boolean;
  correctAnswerSnapshot: string | null;
  submittedAnswer: string | null;
  wasCorrect: boolean | null;
  choices: Array<{ id: string; position: number; isCorrect: boolean }>;
};

type LearningRecord = {
  learningId: string;
  listId: string;
  learnerUserId: string;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  gradedAnswerCount: number;
  correctAnswerCount: number;
  incorrectAnswerCount: number;
  servedCheckpointGroupCount: number;
};

export type FakeVocabularyLearningSource = VocabularyLearningSource & {
  getServedCheckpointGroupCount(learningId: string): number;
  getSessionId(learningId: string): string | null;
  findSpellingAttemptForSpeech(
    userId: string,
    attemptId: string
  ): Promise<{ canonicalSpelling: string; speechDefinition: string } | null>;
};

export function createFakeVocabularyLearningSource(
  learnings: readonly FakeVocabularyLearning[],
  listWords: readonly FakeVocabularyListWordSeed[]
): FakeVocabularyLearningSource {
  const learningById = new Map<string, LearningRecord>(
    learnings.map((learning) => [
      learning.learningId,
      {
        learningId: learning.learningId,
        listId: learning.listId,
        learnerUserId: learning.learnerUserId,
        status: learning.status ?? "ACTIVE",
        gradedAnswerCount: 0,
        correctAnswerCount: 0,
        incorrectAnswerCount: 0,
        servedCheckpointGroupCount: 0,
      },
    ])
  );
  const progressByLearningId = new Map<string, Map<string, VocabularyProgressRow>>();
  const sessionsByLearningId = new Map<string, Session[]>();
  const attemptsById = new Map<string, Attempt>();

  function wordsForList(listId: string): FakeVocabularyListWordSeed[] {
    return listWords.filter((word) => word.listId === listId);
  }

  function progressRows(learningId: string): VocabularyProgressRow[] {
    return [...(progressByLearningId.get(learningId)?.values() ?? [])];
  }

  function buildPanel(learningId: string, sessionId: string): VocabularyPanelSnapshot {
    const learning = learningById.get(learningId);
    if (!learning) {
      return { wordList: [], spellingWords: [], masteredWords: [] };
    }
    const rows = progressRows(learningId);
    const words = wordsForList(learning.listId);
    const textById = new Map(words.map((word) => [word.id, word.word]));
    const activeFive = new Set(
      [...rows]
        .filter((row) => !row.spellingMastered)
        .sort((left, right) => left.position - right.position)
        .slice(0, 5)
        .map((row) => row.listWordId)
    );
    const byPosition = (left: VocabularyProgressRow, right: VocabularyProgressRow) =>
      left.position - right.position;
    const toDisplay = (row: VocabularyProgressRow) => ({
      id: `panel-${sessionId}-${row.listWordId}`,
      word: textById.get(row.listWordId) ?? "",
    });
    return {
      wordList: rows
        .filter((row) => activeFive.has(row.listWordId) && !row.definitionMastered && !row.spellingMastered)
        .sort(byPosition)
        .map(toDisplay),
      spellingWords: rows
        .filter((row) => activeFive.has(row.listWordId) && row.definitionMastered && !row.spellingMastered)
        .sort(byPosition)
        .map((row) => ({ id: `panel-${sessionId}-${row.listWordId}` })),
      masteredWords: rows
        .filter((row) => row.spellingMastered)
        .sort(byPosition)
        .map(toDisplay),
    };
  }

  function buildProgress(learningId: string, sessionId: string): VocabularyProgressSnapshot {
    const learning = learningById.get(learningId);
    const session = sessionsByLearningId
      .get(learningId)
      ?.find((candidate) => candidate.id === sessionId);
    if (!learning || !session) {
      throw new Error("fake vocabulary learning/session not found");
    }
    return {
      learningStatus: learning.status === "COMPLETED" ? "COMPLETED" : "ACTIVE",
      gradedAnswerCount: learning.gradedAnswerCount,
      correctAnswerCount: learning.correctAnswerCount,
      incorrectAnswerCount: learning.incorrectAnswerCount,
      stateVersion: session.stateVersion,
      panel: buildPanel(learningId, sessionId),
    };
  }

  return {
    async authorize(userId, learningId) {
      const learning = learningById.get(learningId);
      if (!learning || learning.learnerUserId !== userId || learning.status === "ARCHIVED") {
        return null;
      }
      return { learningId: learning.learningId, listId: learning.listId };
    },

    async initialize(userId, learningId): Promise<VocabularyLearningSession | null> {
      const learning = learningById.get(learningId);
      if (!learning || learning.learnerUserId !== userId || learning.status === "ARCHIVED") {
        return null;
      }

      let progress = progressByLearningId.get(learningId);
      if (!progress) {
        progress = new Map();
        progressByLearningId.set(learningId, progress);
      }
      for (const word of wordsForList(learning.listId)) {
        if (!progress.has(word.id)) {
          progress.set(
            word.id,
            createDefaultVocabularyProgressRow(word.id, word.position)
          );
        }
      }

      const sessions = sessionsByLearningId.get(learningId) ?? [];
      for (const session of sessions) {
        if (session.status === "ACTIVE") {
          session.status = "ENDED";
          for (const attempt of attemptsById.values()) {
            if (attempt.sessionId === session.id && attempt.status === "ACTIVE") {
              attempt.status = "EXPIRED";
            }
          }
        }
      }
      const newSession: Session = {
        id: randomUUID(),
        learningId,
        status: "ACTIVE",
        stateVersion: 0,
      };
      sessions.push(newSession);
      sessionsByLearningId.set(learningId, sessions);

      const rows = [...progress.values()];
      return {
        learningId,
        listId: learning.listId,
        sessionId: newSession.id,
        totalWordCount: wordsForList(learning.listId).length,
        progress: buildProgress(learningId, newSession.id),
        dueReviewListWordIds: rows
          .filter(
            (row) =>
              row.nextReviewQuestionNumber !== null &&
              row.nextReviewQuestionNumber <= learning.gradedAnswerCount
          )
          .map((row) => row.listWordId),
        activeFiveListWordIds: [...rows]
          .filter((row) => !row.spellingMastered)
          .sort((left, right) => left.position - right.position)
          .slice(0, 5)
          .map((row) => row.listWordId),
        servedCheckpointGroupCount: learning.servedCheckpointGroupCount,
        progressRows: rows,
      };
    },

    async markIntroduced(learningId, _sessionId, listWordId) {
      const row = progressByLearningId.get(learningId)?.get(listWordId);
      if (row && !row.introduced) {
        row.introduced = true;
      }
    },

    async createDefinitionAttempt(learningId, sessionId, listWordId, review, choices) {
      const attemptId = randomUUID();
      const createdChoices = (choices as readonly VocabularyDefinitionChoiceInput[]).map(
        (choice) => ({
          id: randomUUID(),
          position: choice.position,
          isCorrect: choice.isCorrect,
        })
      );
      attemptsById.set(attemptId, {
        id: attemptId,
        sessionId,
        listWordId,
        answerType: "DEFINITION",
        status: "ACTIVE",
        review,
        correctAnswerSnapshot: null,
        submittedAnswer: null,
        wasCorrect: null,
        choices: createdChoices,
      });
      if (!review) {
        const row = progressByLearningId.get(learningId)?.get(listWordId);
        if (row) {
          row.practicePresentationCount += 1;
        }
      }
      return { attemptId, choices: createdChoices };
    },

    async createSpellingAttempt(learningId, sessionId, listWordId, review, canonicalSpelling) {
      const attemptId = randomUUID();
      attemptsById.set(attemptId, {
        id: attemptId,
        sessionId,
        listWordId,
        answerType: "SPELLING",
        status: "ACTIVE",
        review,
        correctAnswerSnapshot: canonicalSpelling,
        submittedAnswer: null,
        wasCorrect: null,
        choices: [],
      });
      if (!review) {
        const row = progressByLearningId.get(learningId)?.get(listWordId);
        if (row) {
          row.practicePresentationCount += 1;
        }
      }
      return { attemptId };
    },

    async commitAnswer(userId, submission): Promise<VocabularyCommitResult> {
      const attempt = attemptsById.get(submission.attemptId);
      const session = attempt
        ? [...sessionsByLearningId.values()].flat().find((s) => s.id === attempt.sessionId)
        : undefined;
      const learning = session ? learningById.get(session.learningId) : undefined;
      if (
        !attempt ||
        !session ||
        !learning ||
        learning.learnerUserId !== userId ||
        (attempt.answerType === "DEFINITION") !== (submission.answerType === "definition")
      ) {
        return { status: "invalid" };
      }

      const submittedValue =
        submission.answerType === "definition"
          ? submission.selectedChoiceId
          : submission.answer.trim().toLocaleLowerCase("en-US");

      if (attempt.status === "ANSWERED") {
        if (attempt.submittedAnswer !== submittedValue) {
          return { status: "rejected-modified-retry" };
        }
        return {
          status: "ok",
          correct: attempt.wasCorrect ?? false,
          correctChoiceId:
            attempt.answerType === "DEFINITION"
              ? attempt.choices.find((choice) => choice.isCorrect)?.id ?? null
              : null,
          correctAnswer:
            attempt.answerType === "SPELLING" && !attempt.wasCorrect
              ? attempt.correctAnswerSnapshot
              : null,
          progress: buildProgress(learning.learningId, session.id),
        };
      }

      if (attempt.status !== "ACTIVE") {
        return { status: "invalid" };
      }

      let correct: boolean;
      let correctChoiceId: string | null = null;
      let correctAnswer: string | null = null;
      if (submission.answerType === "definition") {
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
        correct =
          submittedValue === attempt.correctAnswerSnapshot.trim().toLocaleLowerCase("en-US");
        correctAnswer = correct ? null : attempt.correctAnswerSnapshot;
      }

      const progressMap = progressByLearningId.get(learning.learningId);
      const currentProgress = progressMap?.get(attempt.listWordId);
      if (!progressMap || !currentProgress) {
        return { status: "invalid" };
      }

      const gradedAnswerCountAfter = learning.gradedAnswerCount + 1;
      const transition = applyVocabularyAnswerTransition({
        progress: currentProgress,
        answerType: attempt.answerType,
        review: attempt.review,
        correct,
        gradedAnswerCountAfter,
      });

      if (transition.firstSpellingMasteryNow) {
        const masteredCount = [...progressMap.values()].filter(
          (row) => row.initialMasterySequence !== null
        ).length;
        transition.progress.initialMasterySequence = masteredCount + 1;
      }
      progressMap.set(attempt.listWordId, transition.progress);

      attempt.status = "ANSWERED";
      attempt.submittedAnswer = submittedValue;
      attempt.wasCorrect = correct;

      learning.gradedAnswerCount += 1;
      if (correct) {
        learning.correctAnswerCount += 1;
      } else {
        learning.incorrectAnswerCount += 1;
      }
      session.stateVersion += 1;

      const rows = [...progressMap.values()];
      const totalWordCount = wordsForList(learning.listId).length;
      if (
        learning.status !== "COMPLETED" &&
        isVocabularyLearningComplete(
          rows,
          totalWordCount,
          learning.gradedAnswerCount,
          learning.servedCheckpointGroupCount
        )
      ) {
        learning.status = "COMPLETED";
        session.status = "ENDED";
      }

      return {
        status: "ok",
        correct,
        correctChoiceId,
        correctAnswer,
        progress: buildProgress(learning.learningId, session.id),
      };
    },

    async serveCheckpointGroup(learningId) {
      const learning = learningById.get(learningId);
      if (!learning) {
        return null;
      }
      const rows = progressRows(learningId);
      const nextGroup = selectNextVocabularyCheckpointGroup(
        rows,
        learning.servedCheckpointGroupCount
      );
      if (!nextGroup) {
        return null;
      }
      learning.servedCheckpointGroupCount += 1;
      return nextGroup;
    },

    getServedCheckpointGroupCount(learningId) {
      return learningById.get(learningId)?.servedCheckpointGroupCount ?? 0;
    },

    getSessionId(learningId) {
      const sessions = sessionsByLearningId.get(learningId) ?? [];
      return sessions.find((session) => session.status === "ACTIVE")?.id ?? null;
    },

    async findSpellingAttemptForSpeech(userId, attemptId) {
      const attempt = attemptsById.get(attemptId);
      const session = attempt
        ? [...sessionsByLearningId.values()].flat().find((s) => s.id === attempt.sessionId)
        : undefined;
      const learning = session ? learningById.get(session.learningId) : undefined;
      if (
        !attempt ||
        !learning ||
        attempt.status !== "ACTIVE" ||
        attempt.answerType !== "SPELLING" ||
        learning.learnerUserId !== userId ||
        !attempt.correctAnswerSnapshot
      ) {
        return null;
      }
      const word = wordsForList(learning.listId).find((w) => w.id === attempt.listWordId);
      if (!word || !word.definition) {
        return null;
      }
      return {
        canonicalSpelling: attempt.correctAnswerSnapshot,
        speechDefinition: word.definition,
      };
    },
  };
}
