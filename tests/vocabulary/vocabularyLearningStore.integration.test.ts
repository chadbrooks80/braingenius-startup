import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import prisma from "@/lib/db";
import {
  authorizeVocabularyLearning,
  commitVocabularyAnswer,
  createVocabularyDefinitionAttempt,
  createVocabularySpellingAttempt,
  initializeVocabularyLearning,
  serveNextVocabularyCheckpointGroup,
} from "@/learning-modules/vocabulary/server/vocabularyLearningStore";

// Real-Postgres boundary test for the durable Vocabulary learning/progress
// repository, mirroring `tests/vocabulary/vocabularyListStore.integration.test.ts`
// and `tests/auth/atomicAuthDatabase.integration.test.ts`. It only runs
// against an approved disposable local/test-named database and skips
// otherwise -- see `docs/reference/testing.md`. The mastery/review/checkpoint
// matrix itself is exhaustively covered without a database by
// `tests/vocabulary/vocabularyProgressProjection.test.ts`; this file proves
// only that the real Prisma transaction boundary wires that logic correctly
// (durable attempt creation, exactly-once grading, counter updates, and
// checkpoint serving actually commit together).

function disposableDatabaseSkipReason(): string | false {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return "DATABASE_URL is not configured for an approved disposable database";
  }

  try {
    const parsed = new URL(rawUrl);
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    const databaseName = decodeURIComponent(parsed.pathname.slice(1));
    const isTestNamed = /(^|[_-])(test|testing|tmp|temp|ci)([_-]|$)/i.test(databaseName);
    if (!isLocalHost || !isTestNamed) {
      return "DATABASE_URL is not an unmistakably local, test-named disposable database";
    }
  } catch {
    return "DATABASE_URL is not parseable as an approved disposable database";
  }

  return false;
}

const skipReason = disposableDatabaseSkipReason();

test(
  "the real Prisma-backed store authorizes by learningId, commits a graded transaction atomically, is idempotent for exact replay, and serves checkpoints once",
  { skip: skipReason, timeout: 30_000 },
  async () => {
    const fixtureId = randomUUID();
    const ownerEmail = `vocab-learning-store-owner-${fixtureId}@example.invalid`;
    const learnerEmail = `vocab-learning-store-learner-${fixtureId}@example.invalid`;
    const otherEmail = `vocab-learning-store-other-${fixtureId}@example.invalid`;
    let listId: string | null = null;
    let learningId: string | null = null;
    const createdUserIds: string[] = [];

    try {
      const owner = await prisma.user.create({ data: { email: ownerEmail, role: "PARENT" } });
      createdUserIds.push(owner.id);
      const learner = await prisma.user.create({ data: { email: learnerEmail, role: "CHILD" } });
      createdUserIds.push(learner.id);
      const other = await prisma.user.create({ data: { email: otherEmail, role: "PARENT" } });
      createdUserIds.push(other.id);

      const list = await prisma.modVocabList.create({
        data: { ownerUserId: owner.id, name: `Disposable Learning Store List ${fixtureId}` },
      });
      listId = list.id;

      const wordSeeds = Array.from({ length: 6 }, (_unused, index) => ({
        listId: list.id,
        position: index + 1,
        word: `learningword${fixtureId.slice(0, 6)}${index}`,
        normalizedWord: `learningword${fixtureId.slice(0, 6)}${index}`,
        definition: `definition ${index}`,
        spellingDefinition: `spelling definition ${index}`,
        exampleSentence1: `Example one ${index}.`,
        exampleSentence2: `Example two ${index}.`,
        exampleSentence3: `Example three ${index}.`,
        interestingFact: `Fact ${index}.`,
      }));
      await prisma.modVocabListWord.createMany({ data: wordSeeds });
      const listWords = await prisma.modVocabListWord.findMany({
        where: { listId: list.id },
        orderBy: { position: "asc" },
      });

      // The learner does not own the list -- proving learningId authorization
      // is independent of ModVocabList ownership.
      const learning = await prisma.modVocabLearning.create({
        data: { listId: list.id, learnerUserId: learner.id, assignedByUserId: owner.id },
      });
      learningId = learning.id;

      const authorizedForLearner = await authorizeVocabularyLearning(learner.id, learning.id);
      assert.deepEqual(authorizedForLearner, { learningId: learning.id, listId: list.id });
      assert.equal(await authorizeVocabularyLearning(other.id, learning.id), null);
      assert.equal(await authorizeVocabularyLearning(learner.id, "missing-learning"), null);

      const session = await initializeVocabularyLearning(learner.id, learning.id);
      assert.ok(session);
      assert.equal(session.totalWordCount, 6);
      assert.equal(session.progress.panel.wordList.length, 5);

      // Re-initializing (a second visit) must not overwrite existing progress
      // rows and must safely end the prior session.
      const secondVisit = await initializeVocabularyLearning(learner.id, learning.id);
      assert.ok(secondVisit);
      assert.notEqual(secondVisit.sessionId, session.sessionId);

      const targetWord = listWords[0];

      // Master the first word: three correct definition answers, then three
      // correct spelling answers, each transactionally committed.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const created = await createVocabularyDefinitionAttempt(
          learning.id,
          secondVisit.sessionId,
          targetWord.id,
          false,
          [
            { sourceListWordId: targetWord.id, position: 0, textSnapshot: "correct", isCorrect: true },
            { sourceListWordId: null, position: 1, textSnapshot: "wrong-a", isCorrect: false },
            { sourceListWordId: null, position: 2, textSnapshot: "wrong-b", isCorrect: false },
            { sourceListWordId: null, position: 3, textSnapshot: "wrong-c", isCorrect: false },
          ]
        );
        const correctChoiceId = created.choices[0].id;

        const commit = await commitVocabularyAnswer(learner.id, {
          answerType: "DEFINITION",
          attemptId: created.attemptId,
          selectedChoiceId: correctChoiceId,
        });
        assert.equal(commit.status, "ok");
        if (commit.status === "ok") {
          assert.equal(commit.correct, true);
        }

        // Exact-duplicate replay returns the same result without a second
        // increment; a modified duplicate is rejected.
        const replay = await commitVocabularyAnswer(learner.id, {
          answerType: "DEFINITION",
          attemptId: created.attemptId,
          selectedChoiceId: correctChoiceId,
        });
        assert.equal(replay.status, "ok");
        const modifiedReplay = await commitVocabularyAnswer(learner.id, {
          answerType: "DEFINITION",
          attemptId: created.attemptId,
          selectedChoiceId: created.choices[1].id,
        });
        assert.equal(modifiedReplay.status, "rejected-modified-retry");
      }

      const progressAfterDefinition = await prisma.modVocabWordProgress.findUniqueOrThrow({
        where: { learningId_listWordId: { learningId: learning.id, listWordId: targetWord.id } },
      });
      assert.equal(progressAfterDefinition.definitionMastered, true);
      assert.equal(progressAfterDefinition.definitionConsecutiveCorrect, 3);

      let lastCommitProgress = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const created = await createVocabularySpellingAttempt(
          learning.id,
          secondVisit.sessionId,
          targetWord.id,
          false,
          targetWord.word
        );
        const commit = await commitVocabularyAnswer(learner.id, {
          answerType: "SPELLING",
          attemptId: created.attemptId,
          answer: targetWord.word,
        });
        assert.equal(commit.status, "ok");
        if (commit.status === "ok") {
          assert.equal(commit.correct, true);
          lastCommitProgress = commit.progress;
        }
      }
      assert.ok(lastCommitProgress);
      assert.equal(
        lastCommitProgress!.panel.masteredWords.some((entry) => entry.word === targetWord.word),
        true
      );

      const finalProgress = await prisma.modVocabWordProgress.findUniqueOrThrow({
        where: { learningId_listWordId: { learningId: learning.id, listWordId: targetWord.id } },
      });
      assert.equal(finalProgress.spellingMastered, true);
      assert.equal(finalProgress.initialMasterySequence, 1);
      assert.ok(finalProgress.nextReviewQuestionNumber !== null);

      const updatedLearning = await prisma.modVocabLearning.findUniqueOrThrow({
        where: { id: learning.id },
      });
      assert.equal(updatedLearning.gradedAnswerCount, 6);
      assert.equal(updatedLearning.correctAnswerCount, 6);
      assert.equal(updatedLearning.incorrectAnswerCount, 0);

      const dailyPractice = await prisma.modVocabDailyPractice.findFirst({
        where: { learnerUserId: learner.id },
      });
      assert.ok(dailyPractice);
      assert.equal(dailyPractice!.questionsAnswered, 6);
      assert.equal(dailyPractice!.correctAnswers, 6);

      // Only one word is mastered, so no checkpoint group has been earned yet.
      assert.equal(await serveNextVocabularyCheckpointGroup(learning.id), null);
    } finally {
      if (learningId) {
        await prisma.modVocabLearning.delete({ where: { id: learningId } });
      }
      if (listId) {
        await prisma.modVocabList.delete({ where: { id: listId } });
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    }
  }
);
