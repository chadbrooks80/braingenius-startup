import "server-only";

import prisma from "@/lib/db";

// Module-owned Prisma boundary for `ModVocabList`/`ModVocabListWord`. Every
// query is bounded (a single row, a small `take`, or a count) so a list with
// hundreds of words never causes an unbounded canonical-content load. Narrow
// DB-shaped interfaces (not the raw Prisma client) are threaded through so
// tests can inject a deterministic in-memory double instead of a real
// database, matching the existing `ttsUsageService`/`effective-subscription-tier`
// convention.

export type VocabularyListWordRow = {
  id: string;
  position: number;
  word: string;
  definition: string | null;
  spellingDefinition: string | null;
  exampleSentence1: string | null;
  exampleSentence2: string | null;
  exampleSentence3: string | null;
  interestingFact: string | null;
};

const LIST_WORD_SELECT = {
  id: true,
  position: true,
  word: true,
  definition: true,
  spellingDefinition: true,
  exampleSentence1: true,
  exampleSentence2: true,
  exampleSentence3: true,
  interestingFact: true,
} as const;

export type VocabularyDistractorRow = {
  id: string;
  definition: string;
};

export type VocabularyListStoreDb = {
  findOwnedListId(userId: string, listId: string): Promise<string | null>;
  countListWords(listId: string): Promise<number>;
  findFirstListWords(
    listId: string,
    take: number
  ): Promise<VocabularyListWordRow[]>;
  findNextListWordAfterPosition(
    listId: string,
    afterPosition: number
  ): Promise<VocabularyListWordRow | null>;
  findDistractorDefinitions(
    listId: string,
    excludeWordIds: readonly string[],
    take: number
  ): Promise<VocabularyDistractorRow[]>;
};

const prismaVocabularyListStoreDb: VocabularyListStoreDb = {
  async findOwnedListId(userId, listId) {
    const list = await prisma.modVocabList.findFirst({
      where: { id: listId, ownerUserId: userId },
      select: { id: true },
    });
    return list?.id ?? null;
  },
  countListWords(listId) {
    return prisma.modVocabListWord.count({ where: { listId } });
  },
  findFirstListWords(listId, take) {
    return prisma.modVocabListWord.findMany({
      where: { listId },
      orderBy: { position: "asc" },
      take,
      select: LIST_WORD_SELECT,
    });
  },
  async findNextListWordAfterPosition(listId, afterPosition) {
    const word = await prisma.modVocabListWord.findFirst({
      where: { listId, position: { gt: afterPosition } },
      orderBy: { position: "asc" },
      select: LIST_WORD_SELECT,
    });
    return word ?? null;
  },
  async findDistractorDefinitions(listId, excludeWordIds, take) {
    const rows = await prisma.modVocabListWord.findMany({
      where: {
        listId,
        id: { notIn: [...excludeWordIds] },
        definition: { not: null },
      },
      // Over-fetch a bounded multiple so the caller can randomly sample
      // rather than always offering the same first rows as distractors.
      take: Math.max(take * 3, take),
      select: { id: true, definition: true },
    });
    return rows.filter(
      (row): row is VocabularyDistractorRow =>
        typeof row.definition === "string" && row.definition.trim() !== ""
    );
  },
};

export type VocabularyListStoreDeps = {
  db?: VocabularyListStoreDb;
};

/**
 * Verifies the requested list exists and is owned by the authenticated
 * session user. Returns `false` for both "missing" and "owned by someone
 * else" so callers present the identical safe not-found result either way.
 * Unexpected database failures propagate so callers fail closed instead of
 * treating an outage as a missing list.
 */
export async function isVocabularyListOwnedByUser(
  userId: string,
  listId: string,
  deps: VocabularyListStoreDeps = {}
): Promise<boolean> {
  const db = deps.db ?? prismaVocabularyListStoreDb;
  return (await db.findOwnedListId(userId, listId)) !== null;
}

export async function countVocabularyListWords(
  listId: string,
  deps: VocabularyListStoreDeps = {}
): Promise<number> {
  const db = deps.db ?? prismaVocabularyListStoreDb;
  return db.countListWords(listId);
}

export async function findFirstVocabularyListWords(
  listId: string,
  take: number,
  deps: VocabularyListStoreDeps = {}
): Promise<VocabularyListWordRow[]> {
  const db = deps.db ?? prismaVocabularyListStoreDb;
  return db.findFirstListWords(listId, take);
}

export async function findNextVocabularyListWord(
  listId: string,
  afterPosition: number,
  deps: VocabularyListStoreDeps = {}
): Promise<VocabularyListWordRow | null> {
  const db = deps.db ?? prismaVocabularyListStoreDb;
  return db.findNextListWordAfterPosition(listId, afterPosition);
}

export async function findVocabularyDistractorDefinitions(
  listId: string,
  excludeWordIds: readonly string[],
  take: number,
  deps: VocabularyListStoreDeps = {}
): Promise<VocabularyDistractorRow[]> {
  if (take <= 0) {
    return [];
  }
  const db = deps.db ?? prismaVocabularyListStoreDb;
  return db.findDistractorDefinitions(listId, excludeWordIds, take);
}
