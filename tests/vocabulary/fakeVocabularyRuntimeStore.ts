import {
  parseAttemptIndexRuntimeSnapshot,
  parseCapabilityRuntimeSnapshot,
  parseLessonRuntimeSnapshot,
} from "../../src/learning-modules/vocabulary/server/vocabularyRuntimeSnapshots";
import type { VocabularyRuntimeStore } from "../../src/learning-modules/vocabulary/server/vocabularyRuntimeStore";

// Deterministic in-memory double for `vocabularyRuntimeStore.ts`, matching
// the existing `fakeVocabularyListStore.ts`/`fakeVocabularyLearningStore.ts`
// fake-store convention. Every stored payload round-trips through
// `JSON.parse(JSON.stringify(...))` before being handed to the same strict
// parser the real Prisma-backed store uses, so a bug that leaks a Map, Set,
// function, `undefined`, or otherwise non-JSON-safe value into a snapshot
// fails here exactly as it would against a real `Json` column. Two
// `VocabularyContentCapabilityStore` instances constructed against the same
// fake instance share this one in-memory table, proving cross-instance
// continuation the same way two separate backend processes sharing one
// database would.

type RecordKind = "LESSON" | "CAPABILITY" | "ATTEMPT";

type StoredRecord = {
  payload: unknown;
  stateVersion: number;
  expiresAt: number;
  lessonId: string;
};

export type FakeVocabularyRuntimeStoreOperation =
  | "advanceCapability"
  | "updateLesson"
  | "recordContent"
  | "resolveAnswerAdvance"
  | "createLessonAndCapability";

export type FakeVocabularyRuntimeStore = VocabularyRuntimeStore & {
  failNext(operation: FakeVocabularyRuntimeStoreOperation): void;
  recordCount(): number;
};

function key(kind: RecordKind, id: string): string {
  return `${kind}:${id}`;
}

function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

export function createFakeVocabularyRuntimeStore(): FakeVocabularyRuntimeStore {
  const records = new Map<string, StoredRecord>();
  let failNextOperation: FakeVocabularyRuntimeStoreOperation | null = null;

  function maybeFail(operation: FakeVocabularyRuntimeStoreOperation): void {
    if (failNextOperation === operation) {
      failNextOperation = null;
      throw new Error(`simulated ${operation} failure`);
    }
  }

  function checkCas(kind: RecordKind, id: string, expectedVersion: number): boolean {
    const row = records.get(key(kind, id));
    return Boolean(row) && row!.stateVersion === expectedVersion;
  }

  function applyCas(kind: RecordKind, id: string, payload: unknown, expiresAt: number): void {
    const row = records.get(key(kind, id));
    if (!row) {
      throw new Error(`fake vocabulary runtime store: missing ${kind} ${id} during commit`);
    }
    records.set(key(kind, id), {
      payload: roundTrip(payload),
      stateVersion: row.stateVersion + 1,
      expiresAt,
      lessonId: row.lessonId,
    });
  }

  return {
    failNext(operation) {
      failNextOperation = operation;
    },

    recordCount() {
      return records.size;
    },

    async createLessonAndCapability(input) {
      maybeFail("createLessonAndCapability");
      records.set(key("LESSON", input.lessonId), {
        payload: roundTrip(input.lessonSnapshot),
        stateVersion: 0,
        expiresAt: input.expiresAt,
        lessonId: input.lessonId,
      });
      records.set(key("CAPABILITY", input.capabilityId), {
        payload: roundTrip(input.capabilitySnapshot),
        stateVersion: 0,
        expiresAt: input.expiresAt,
        lessonId: input.lessonId,
      });
    },

    async loadLesson(lessonId) {
      const row = records.get(key("LESSON", lessonId));
      if (!row) {
        return null;
      }
      const snapshot = parseLessonRuntimeSnapshot(row.payload);
      if (!snapshot) {
        throw new Error("fake vocabulary runtime store: lesson payload failed strict parsing");
      }
      return { snapshot, version: row.stateVersion, expiresAt: row.expiresAt };
    },

    async loadCapability(capabilityId) {
      const row = records.get(key("CAPABILITY", capabilityId));
      if (!row) {
        return null;
      }
      const snapshot = parseCapabilityRuntimeSnapshot(row.payload);
      if (!snapshot) {
        throw new Error(
          "fake vocabulary runtime store: capability payload failed strict parsing"
        );
      }
      return { snapshot, version: row.stateVersion };
    },

    async loadAttemptIndex(attemptId) {
      const row = records.get(key("ATTEMPT", attemptId));
      if (!row) {
        return null;
      }
      const snapshot = parseAttemptIndexRuntimeSnapshot(row.payload);
      if (!snapshot) {
        throw new Error(
          "fake vocabulary runtime store: attempt-index payload failed strict parsing"
        );
      }
      return snapshot;
    },

    async deleteAttemptIndex(attemptId) {
      records.delete(key("ATTEMPT", attemptId));
    },

    async advanceCapability(input) {
      maybeFail("advanceCapability");

      if (!checkCas("CAPABILITY", input.capabilityId, input.expectedCapabilityVersion)) {
        return false;
      }
      if (
        input.lessonUpdate &&
        !checkCas("LESSON", input.lessonId, input.lessonUpdate.expectedVersion)
      ) {
        return false;
      }

      applyCas(
        "CAPABILITY",
        input.capabilityId,
        input.capabilitySnapshot,
        input.lessonExpiresAt
      );
      if (input.lessonUpdate) {
        applyCas("LESSON", input.lessonId, input.lessonUpdate.snapshot, input.lessonExpiresAt);
      }
      if (input.newCapability) {
        records.set(key("CAPABILITY", input.newCapability.id), {
          payload: roundTrip(input.newCapability.snapshot),
          stateVersion: 0,
          expiresAt: input.lessonExpiresAt,
          lessonId: input.lessonId,
        });
      }
      if (input.retireCapabilityId) {
        records.delete(key("CAPABILITY", input.retireCapabilityId));
      }
      return true;
    },

    async updateLesson(input) {
      maybeFail("updateLesson");
      if (!checkCas("LESSON", input.lessonId, input.expectedVersion)) {
        return false;
      }
      applyCas("LESSON", input.lessonId, input.snapshot, input.expiresAt);
      return true;
    },

    async recordContent(input) {
      maybeFail("recordContent");

      if (!checkCas("CAPABILITY", input.capabilityId, input.expectedCapabilityVersion)) {
        return false;
      }
      if (
        input.lessonUpdate &&
        !checkCas("LESSON", input.lessonUpdate.lessonId, input.lessonUpdate.expectedVersion)
      ) {
        return false;
      }

      applyCas("CAPABILITY", input.capabilityId, input.capabilitySnapshot, input.lessonExpiresAt);
      if (input.lessonUpdate) {
        applyCas(
          "LESSON",
          input.lessonUpdate.lessonId,
          input.lessonUpdate.snapshot,
          input.lessonExpiresAt
        );
        if (input.lessonUpdate.attemptIndex) {
          const attemptIndex = input.lessonUpdate.attemptIndex;
          records.set(key("ATTEMPT", attemptIndex.attemptId), {
            payload: roundTrip(attemptIndex.snapshot),
            stateVersion: 0,
            expiresAt: input.lessonExpiresAt,
            lessonId: input.lessonUpdate.lessonId,
          });
        }
      }
      return true;
    },

    async resolveAnswerAdvance(input) {
      maybeFail("resolveAnswerAdvance");

      if (!checkCas("LESSON", input.lessonId, input.expectedLessonVersion)) {
        return false;
      }
      if (!checkCas("CAPABILITY", input.capabilityId, input.expectedCapabilityVersion)) {
        return false;
      }

      applyCas("LESSON", input.lessonId, input.lessonSnapshot, input.lessonExpiresAt);
      applyCas("CAPABILITY", input.capabilityId, input.capabilitySnapshot, input.lessonExpiresAt);
      records.delete(key("ATTEMPT", input.attemptId));
      return true;
    },

    async purgeLessonRecords(lessonId) {
      for (const [recordKey, row] of records) {
        if (row.lessonId === lessonId) {
          records.delete(recordKey);
        }
      }
    },
  };
}
