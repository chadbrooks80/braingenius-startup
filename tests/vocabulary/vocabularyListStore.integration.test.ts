import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import prisma from "@/lib/db";
import {
  countVocabularyListWords,
  findFirstVocabularyListWords,
  findNextVocabularyListWord,
  isVocabularyListOwnedByUser,
} from "@/learning-modules/vocabulary/server/vocabularyListStore";

// Real-Postgres boundary test for the module-owned Vocabulary list
// repository, mirroring `tests/auth/atomicAuthDatabase.integration.test.ts`.
// It only runs against an approved disposable local/test-named database and
// skips otherwise (including against this repository's current `.env`,
// which points at a shared Neon development database) -- see
// `docs/reference/testing.md`. Every other Vocabulary DB-loading test in
// this suite uses the deterministic in-memory
// `tests/vocabulary/fakeVocabularyListStore.ts` double instead, so this file
// is the only one that ever contacts a real database, and only when that
// database is explicitly approved as disposable.

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
  "the real Prisma-backed repository authorizes ownership, bounds initial load to five words, and orders refills strictly by position",
  { skip: skipReason, timeout: 30_000 },
  async () => {
    const fixtureId = randomUUID();
    const ownerEmail = `vocab-list-store-owner-${fixtureId}@example.invalid`;
    const otherEmail = `vocab-list-store-other-${fixtureId}@example.invalid`;
    let listId: string | null = null;
    const createdUserIds: string[] = [];

    try {
      const owner = await prisma.user.create({
        data: { email: ownerEmail, role: "PARENT" },
      });
      createdUserIds.push(owner.id);
      const other = await prisma.user.create({
        data: { email: otherEmail, role: "PARENT" },
      });
      createdUserIds.push(other.id);

      const list = await prisma.modVocabList.create({
        data: { ownerUserId: owner.id, name: `Disposable Test List ${fixtureId}` },
      });
      listId = list.id;

      // Deliberately non-contiguous positions, proving the repository
      // never assumes dense ordering.
      const positions = [1, 2, 3, 4, 5, 10, 20];
      await prisma.modVocabListWord.createMany({
        data: positions.map((position) => ({
          listId: list.id,
          position,
          word: `word-${fixtureId}-${position}`,
          normalizedWord: `word-${fixtureId}-${position}`,
          definition: `definition ${position}`,
          spellingDefinition: `spelling definition ${position}`,
          exampleSentence1: `Example one ${position}.`,
          exampleSentence2: `Example two ${position}.`,
          exampleSentence3: `Example three ${position}.`,
          interestingFact: `Fact ${position}.`,
        })),
      });

      assert.equal(await isVocabularyListOwnedByUser(owner.id, list.id), true);
      assert.equal(await isVocabularyListOwnedByUser(other.id, list.id), false);
      assert.equal(await isVocabularyListOwnedByUser(owner.id, "nonexistent-list"), false);

      assert.equal(await countVocabularyListWords(list.id), positions.length);

      const firstFive = await findFirstVocabularyListWords(list.id, 5);
      assert.deepEqual(
        firstFive.map((word) => word.position),
        [1, 2, 3, 4, 5]
      );

      const afterFive = await findNextVocabularyListWord(list.id, 5);
      assert.equal(afterFive?.position, 10);

      const afterTen = await findNextVocabularyListWord(list.id, 10);
      assert.equal(afterTen?.position, 20);

      const afterTwenty = await findNextVocabularyListWord(list.id, 20);
      assert.equal(afterTwenty, null);
    } finally {
      if (listId) {
        await prisma.modVocabList.delete({ where: { id: listId } });
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    }
  }
);
