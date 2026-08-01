import "server-only";

import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import {
  parseAttemptIndexRuntimeSnapshot,
  parseCapabilityRuntimeSnapshot,
  parseLessonRuntimeSnapshot,
  type AttemptIndexRuntimeSnapshot,
  type CapabilityRuntimeSnapshot,
  type LessonRuntimeSnapshot,
} from "./vocabularyRuntimeSnapshots";

// Module-owned Prisma repository for `ModVocabRuntimeRecord`, the shared
// durable replacement for `VocabularyContentCapabilityStore`'s three former
// in-memory Maps. Exposes a narrow, purpose-built interface (not the raw
// Prisma client) matching the existing `vocabularyListStore.ts`/
// `vocabularyLearningStore.ts` convention, so production code is injectable
// and tests can supply a fully deterministic in-memory double
// (`tests/vocabulary/fakeVocabularyRuntimeStore.ts`) instead of a real
// database. Every multi-record mutation runs inside one Prisma transaction;
// every conditional update compares-and-swaps on `stateVersion` so two
// backend processes can never both advance the same record from the same
// committed state. This store never interprets snapshot payloads beyond
// strict parsing (`vocabularyRuntimeSnapshots.ts`); domain orchestration,
// retry policy, and the fixed non-sliding expiry rule remain owned by
// `VocabularyContentCapabilityStore`.

export type LoadedLessonRecord = {
  snapshot: LessonRuntimeSnapshot;
  version: number;
  expiresAt: number;
};

export type LoadedCapabilityRecord = {
  snapshot: CapabilityRuntimeSnapshot;
  version: number;
};

export type VocabularyRuntimeStore = {
  createLessonAndCapability(input: {
    lessonId: string;
    userId: string;
    listId: string;
    expiresAt: number;
    lessonSnapshot: LessonRuntimeSnapshot;
    capabilityId: string;
    capabilitySnapshot: CapabilityRuntimeSnapshot;
  }): Promise<void>;

  loadLesson(lessonId: string): Promise<LoadedLessonRecord | null>;
  loadCapability(capabilityId: string): Promise<LoadedCapabilityRecord | null>;
  loadAttemptIndex(attemptId: string): Promise<AttemptIndexRuntimeSnapshot | null>;
  deleteAttemptIndex(attemptId: string): Promise<void>;

  // The `authorizeContent` "advance to the next screen" transition: marks
  // the current capability's successor, optionally issues a fresh successor
  // capability row, optionally retires the predecessor capability, and
  // optionally persists an advanced lesson-state snapshot (when the
  // transition is not a practice-activation placeholder) -- all atomically.
  // Returns false when a concurrent writer already committed first; the
  // caller re-reads and follows the exact-replay/duplicate contract.
  advanceCapability(input: {
    lessonId: string;
    listId: string;
    userId: string;
    lessonExpiresAt: number;
    capabilityId: string;
    expectedCapabilityVersion: number;
    capabilitySnapshot: CapabilityRuntimeSnapshot;
    newCapability: { id: string; snapshot: CapabilityRuntimeSnapshot } | null;
    retireCapabilityId: string | null;
    lessonUpdate: { expectedVersion: number; snapshot: LessonRuntimeSnapshot } | null;
  }): Promise<boolean>;

  // A standalone lesson-snapshot CAS update, used for best-effort word-cache
  // population and for the authorized refill transition.
  updateLesson(input: {
    lessonId: string;
    expectedVersion: number;
    snapshot: LessonRuntimeSnapshot;
    expiresAt: number;
  }): Promise<boolean>;

  // The `recordContentResponse` transition: caches a capability's built
  // public content and, for a graded practice screen, atomically persists
  // the lesson's newly activated attempt plus its attempt-index row
  // together.
  recordContent(input: {
    // The lesson's own fixed, non-sliding expiry, reused verbatim for every
    // row this call writes so a capability rotation can never push a
    // record's expiry later than the lesson's original 30-minute window.
    lessonExpiresAt: number;
    capabilityId: string;
    expectedCapabilityVersion: number;
    capabilitySnapshot: CapabilityRuntimeSnapshot;
    lessonUpdate: {
      lessonId: string;
      expectedVersion: number;
      snapshot: LessonRuntimeSnapshot;
      attemptIndex: {
        attemptId: string;
        userId: string;
        listId: string;
        snapshot: AttemptIndexRuntimeSnapshot;
      } | null;
    } | null;
  }): Promise<boolean>;

  // The `resolveAnswer` sequencer-mirror advance: persists the graded
  // lesson snapshot and successor capability step together and consumes
  // (deletes) the attempt-index row in the same transaction.
  resolveAnswerAdvance(input: {
    attemptId: string;
    lessonExpiresAt: number;
    lessonId: string;
    expectedLessonVersion: number;
    lessonSnapshot: LessonRuntimeSnapshot;
    capabilityId: string;
    expectedCapabilityVersion: number;
    capabilitySnapshot: CapabilityRuntimeSnapshot;
  }): Promise<boolean>;

  // Removes every runtime record (lesson, capability, attempt-index) for a
  // lesson once the capability store has determined -- from the lesson's
  // own fixed, non-sliding `expiresAt` -- that it is expired.
  purgeLessonRecords(lessonId: string): Promise<void>;
};

class VocabularyRuntimeCasConflict extends Error {}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function requireLessonSnapshot(payload: Prisma.JsonValue): LessonRuntimeSnapshot {
  const snapshot = parseLessonRuntimeSnapshot(payload);
  if (!snapshot) {
    throw new Error("Vocabulary runtime lesson payload failed strict parsing.");
  }
  return snapshot;
}

function requireCapabilitySnapshot(payload: Prisma.JsonValue): CapabilityRuntimeSnapshot {
  const snapshot = parseCapabilityRuntimeSnapshot(payload);
  if (!snapshot) {
    throw new Error("Vocabulary runtime capability payload failed strict parsing.");
  }
  return snapshot;
}

function requireAttemptIndexSnapshot(payload: Prisma.JsonValue): AttemptIndexRuntimeSnapshot {
  const snapshot = parseAttemptIndexRuntimeSnapshot(payload);
  if (!snapshot) {
    throw new Error("Vocabulary runtime attempt-index payload failed strict parsing.");
  }
  return snapshot;
}

async function casUpdate(
  tx: Prisma.TransactionClient,
  recordKind: "LESSON" | "CAPABILITY" | "ATTEMPT",
  id: string,
  expectedVersion: number,
  payload: unknown,
  expiresAt: number
): Promise<boolean> {
  const result = await tx.modVocabRuntimeRecord.updateMany({
    where: { recordKind, id, stateVersion: expectedVersion },
    data: {
      payload: toJsonInput(payload),
      expiresAt: new Date(expiresAt),
      stateVersion: { increment: 1 },
    },
  });
  return result.count === 1;
}

const prismaVocabularyRuntimeStore: VocabularyRuntimeStore = {
  async createLessonAndCapability(input) {
    await prisma.modVocabRuntimeRecord.createMany({
      data: [
        {
          recordKind: "LESSON",
          id: input.lessonId,
          lessonId: input.lessonId,
          learnerId: input.userId,
          wordListId: input.listId,
          payload: toJsonInput(input.lessonSnapshot),
          expiresAt: new Date(input.expiresAt),
        },
        {
          recordKind: "CAPABILITY",
          id: input.capabilityId,
          lessonId: input.lessonId,
          learnerId: input.userId,
          wordListId: input.listId,
          payload: toJsonInput(input.capabilitySnapshot),
          expiresAt: new Date(input.expiresAt),
        },
      ],
    });
  },

  async loadLesson(lessonId) {
    const row = await prisma.modVocabRuntimeRecord.findUnique({
      where: { recordKind_id: { recordKind: "LESSON", id: lessonId } },
    });
    if (!row) {
      return null;
    }
    return {
      snapshot: requireLessonSnapshot(row.payload),
      version: row.stateVersion,
      expiresAt: row.expiresAt.getTime(),
    };
  },

  async loadCapability(capabilityId) {
    const row = await prisma.modVocabRuntimeRecord.findUnique({
      where: { recordKind_id: { recordKind: "CAPABILITY", id: capabilityId } },
    });
    if (!row) {
      return null;
    }
    return {
      snapshot: requireCapabilitySnapshot(row.payload),
      version: row.stateVersion,
    };
  },

  async loadAttemptIndex(attemptId) {
    const row = await prisma.modVocabRuntimeRecord.findUnique({
      where: { recordKind_id: { recordKind: "ATTEMPT", id: attemptId } },
    });
    if (!row) {
      return null;
    }
    return requireAttemptIndexSnapshot(row.payload);
  },

  async deleteAttemptIndex(attemptId) {
    await prisma.modVocabRuntimeRecord
      .delete({ where: { recordKind_id: { recordKind: "ATTEMPT", id: attemptId } } })
      .catch(() => undefined);
  },

  async advanceCapability(input) {
    try {
      return await prisma.$transaction(async (tx) => {
        const capabilityOk = await casUpdate(
          tx,
          "CAPABILITY",
          input.capabilityId,
          input.expectedCapabilityVersion,
          input.capabilitySnapshot,
          input.lessonExpiresAt
        );
        if (!capabilityOk) {
          throw new VocabularyRuntimeCasConflict();
        }

        if (input.lessonUpdate) {
          const lessonOk = await casUpdate(
            tx,
            "LESSON",
            input.lessonId,
            input.lessonUpdate.expectedVersion,
            input.lessonUpdate.snapshot,
            input.lessonExpiresAt
          );
          if (!lessonOk) {
            throw new VocabularyRuntimeCasConflict();
          }
        }

        if (input.newCapability) {
          await tx.modVocabRuntimeRecord.create({
            data: {
              recordKind: "CAPABILITY",
              id: input.newCapability.id,
              lessonId: input.lessonId,
              learnerId: input.userId,
              wordListId: input.listId,
              payload: toJsonInput(input.newCapability.snapshot),
              expiresAt: new Date(input.lessonExpiresAt),
            },
          });
        }

        if (input.retireCapabilityId) {
          await tx.modVocabRuntimeRecord
            .delete({
              where: { recordKind_id: { recordKind: "CAPABILITY", id: input.retireCapabilityId } },
            })
            .catch(() => undefined);
        }

        return true;
      });
    } catch (error) {
      if (error instanceof VocabularyRuntimeCasConflict) {
        return false;
      }
      throw error;
    }
  },

  async updateLesson(input) {
    return casUpdate(prisma, "LESSON", input.lessonId, input.expectedVersion, input.snapshot, input.expiresAt);
  },

  async recordContent(input) {
    try {
      return await prisma.$transaction(async (tx) => {
        const capabilityOk = await casUpdate(
          tx,
          "CAPABILITY",
          input.capabilityId,
          input.expectedCapabilityVersion,
          input.capabilitySnapshot,
          input.lessonExpiresAt
        );
        if (!capabilityOk) {
          throw new VocabularyRuntimeCasConflict();
        }

        if (input.lessonUpdate) {
          const lessonOk = await casUpdate(
            tx,
            "LESSON",
            input.lessonUpdate.lessonId,
            input.lessonUpdate.expectedVersion,
            input.lessonUpdate.snapshot,
            input.lessonExpiresAt
          );
          if (!lessonOk) {
            throw new VocabularyRuntimeCasConflict();
          }

          if (input.lessonUpdate.attemptIndex) {
            const attemptIndex = input.lessonUpdate.attemptIndex;
            await tx.modVocabRuntimeRecord.create({
              data: {
                recordKind: "ATTEMPT",
                id: attemptIndex.attemptId,
                lessonId: input.lessonUpdate.lessonId,
                learnerId: attemptIndex.userId,
                wordListId: attemptIndex.listId,
                payload: toJsonInput(attemptIndex.snapshot),
                expiresAt: new Date(input.lessonExpiresAt),
              },
            });
          }
        }

        return true;
      });
    } catch (error) {
      if (error instanceof VocabularyRuntimeCasConflict) {
        return false;
      }
      throw error;
    }
  },

  async resolveAnswerAdvance(input) {
    try {
      return await prisma.$transaction(async (tx) => {
        const lessonOk = await casUpdate(
          tx,
          "LESSON",
          input.lessonId,
          input.expectedLessonVersion,
          input.lessonSnapshot,
          input.lessonExpiresAt
        );
        if (!lessonOk) {
          throw new VocabularyRuntimeCasConflict();
        }

        const capabilityOk = await casUpdate(
          tx,
          "CAPABILITY",
          input.capabilityId,
          input.expectedCapabilityVersion,
          input.capabilitySnapshot,
          input.lessonExpiresAt
        );
        if (!capabilityOk) {
          throw new VocabularyRuntimeCasConflict();
        }

        await tx.modVocabRuntimeRecord
          .delete({ where: { recordKind_id: { recordKind: "ATTEMPT", id: input.attemptId } } })
          .catch(() => undefined);

        return true;
      });
    } catch (error) {
      if (error instanceof VocabularyRuntimeCasConflict) {
        return false;
      }
      throw error;
    }
  },

  async purgeLessonRecords(lessonId) {
    await prisma.modVocabRuntimeRecord.deleteMany({ where: { lessonId } });
  },
};

export const vocabularyRuntimeStore: VocabularyRuntimeStore = prismaVocabularyRuntimeStore;
