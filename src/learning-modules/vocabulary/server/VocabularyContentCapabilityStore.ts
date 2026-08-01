import "server-only";

import { randomInt as secureRandomInt, randomUUID } from "node:crypto";
import {
  findNextVocabularyListWord,
  findVocabularyDistractorDefinitions,
  findVocabularyListWordsByIds,
  type VocabularyDistractorRow,
  type VocabularyListWordRow,
} from "./vocabularyListStore";
import {
  getVocabularyContent,
  type VocabularyContentBuildContext,
  type VocabularyContentBuildResult,
} from "./getVocabularyContent";
import type {
  VocabularyContentResponse,
  VocabularyLessonManifest,
  VocabularyScreenContentType,
} from "../data/vocabularyContentTypes";
import { ACTIVE_POOL_SIZE } from "../state/VocabularyLessonTypes";
import {
  VocabularyLessonState,
  type VocabularyLessonHydration,
} from "../state/VocabularyLessonState";
import type { VocabularyWordProgress } from "../state/VocabularyLessonTypes";
import { createVocabularyLessonRandom } from "../state/createVocabularyLessonRandom";
import type {
  VocabularyAnswerApiResult,
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "../types";
import {
  authorizeVocabularyLearning,
  commitVocabularyAnswer,
  createVocabularyDefinitionAttempt,
  createVocabularySpellingAttempt,
  initializeVocabularyLearning,
  markVocabularyWordIntroduced,
  serveNextVocabularyCheckpointGroup,
  type VocabularyCommitResult,
  type VocabularyLearningSession,
} from "./vocabularyLearningStore";
import {
  vocabularyRuntimeStore,
  type LoadedLessonRecord,
  type VocabularyRuntimeStore,
} from "./vocabularyRuntimeStore";
import type {
  CapabilityRuntimeSnapshot,
  LessonRuntimeSnapshot,
  VocabularyCapabilityContentResponse,
  VocabularyScreenStep,
} from "./vocabularyRuntimeSnapshots";

const DEFAULT_LIFETIME_MS = 30 * 60 * 1_000;
// Bounds the optimistic compare-and-swap retry loop used when two backend
// processes race to advance the same lesson/capability. A real conflict
// resolves within one or two retries (the loser simply re-reads the
// winner's committed state); exceeding this is treated as a genuine
// unavailable-database condition rather than looping forever.
const MAX_CONCURRENCY_RETRIES = 5;

type ScreenStep = VocabularyScreenStep;

// Injected boundary to the module-owned `ModVocabList`/`ModVocabListWord`
// repository. Kept as a narrow interface (not the raw Prisma client or the
// exported repository functions directly) so tests can supply a fully
// deterministic in-memory double, matching the existing
// ttsUsageService/effective-subscription-tier convention.
export type VocabularyListSource = {
  findNext(
    listId: string,
    afterPosition: number
  ): Promise<VocabularyListWordRow | null>;
  findDistractors(
    listId: string,
    excludeIds: readonly string[],
    take: number
  ): Promise<VocabularyDistractorRow[]>;
  findByIds(
    listId: string,
    ids: readonly string[]
  ): Promise<VocabularyListWordRow[]>;
};

const defaultVocabularyListSource: VocabularyListSource = {
  findNext: (listId, afterPosition) =>
    findNextVocabularyListWord(listId, afterPosition),
  findDistractors: (listId, excludeIds, take) =>
    findVocabularyDistractorDefinitions(listId, excludeIds, take),
  findByIds: (listId, ids) => findVocabularyListWordsByIds(listId, ids),
};

// Injected boundary to the durable `vocabularyLearningStore.ts` repository,
// mirroring `VocabularyListSource` above so capability-store orchestration is
// testable with a deterministic double instead of a real database.
export type VocabularyLearningSource = {
  authorize(
    userId: string,
    learningId: string
  ): Promise<{ learningId: string; listId: string } | null>;
  initialize(
    userId: string,
    learningId: string
  ): Promise<VocabularyLearningSession | null>;
  markIntroduced(
    learningId: string,
    sessionId: string,
    listWordId: string
  ): Promise<void>;
  createDefinitionAttempt: typeof createVocabularyDefinitionAttempt;
  createSpellingAttempt: typeof createVocabularySpellingAttempt;
  commitAnswer(
    userId: string,
    submission: VocabularyAnswerSubmission
  ): Promise<VocabularyCommitResult>;
  serveCheckpointGroup(learningId: string): Promise<string[] | null>;
};

const defaultVocabularyLearningSource: VocabularyLearningSource = {
  authorize: authorizeVocabularyLearning,
  initialize: initializeVocabularyLearning,
  markIntroduced: markVocabularyWordIntroduced,
  createDefinitionAttempt: createVocabularyDefinitionAttempt,
  createSpellingAttempt: createVocabularySpellingAttempt,
  commitAnswer: (userId, submission) =>
    commitVocabularyAnswer(
      userId,
      submission.answerType === "definition"
        ? {
            answerType: "DEFINITION",
            attemptId: submission.attemptId,
            selectedChoiceId: submission.selectedChoiceId,
          }
        : {
            answerType: "SPELLING",
            attemptId: submission.attemptId,
            answer: submission.answer,
          }
    ),
  serveCheckpointGroup: serveNextVocabularyCheckpointGroup,
};

type RefillOutcome = { wordId: string | null };

export type AuthorizedVocabularyContent = {
  capability: string;
  lessonId: string;
  contentType: VocabularyScreenContentType;
  listId: string;
  // Empty for word-search-checkpoint, which projects wordIds instead.
  wordId: string;
  wordIds?: string[];
  review?: boolean;
  nextCapability: string;
  // Unused, accepted-and-ignored legacy fields kept only so the protected
  // `tests/learning-engine/vocabularyWindowFlow.test.tsx` fixture (which this
  // feature must not modify) keeps constructing a valid request literal
  // against `getVocabularyContent`. No production code reads either field.
  wordListId?: string;
  attemptId?: string | null;
};

type CapabilityStoreOptions = {
  now?: () => number;
  lifetimeMs?: number;
  seed?: () => number;
  randomInt?: (maxExclusive: number) => number;
  listSource?: VocabularyListSource;
  learningSource?: VocabularyLearningSource;
  runtimeStore?: VocabularyRuntimeStore;
};

export class VocabularyContentCapabilityStore {
  private readonly now: () => number;
  private readonly lifetimeMs: number;
  private readonly seed: () => number;
  private readonly randomInt: (maxExclusive: number) => number;
  private readonly listSource: VocabularyListSource;
  private readonly learningSource: VocabularyLearningSource;
  private readonly runtimeStore: VocabularyRuntimeStore;

  constructor(options: CapabilityStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.lifetimeMs = options.lifetimeMs ?? DEFAULT_LIFETIME_MS;
    this.seed = options.seed ?? (() => secureRandomInt(4_294_967_296));
    this.randomInt = options.randomInt ?? secureRandomInt;
    this.listSource = options.listSource ?? defaultVocabularyListSource;
    this.learningSource = options.learningSource ?? defaultVocabularyLearningSource;
    this.runtimeStore = options.runtimeStore ?? vocabularyRuntimeStore;
  }

  async createManifest(
    userId: string,
    learningId: string
  ): Promise<VocabularyLessonManifest | null> {
    const session = await this.learningSource.initialize(userId, learningId);
    if (!session) {
      return null;
    }

    const lessonId = randomUUID();
    const randomSeed = this.seed() >>> 0;

    const hydratedPositionIds = this.selectHydrationWordIds(session);
    const hydratedRecords =
      hydratedPositionIds.length === 0
        ? []
        : await this.listSource.findByIds(session.listId, hydratedPositionIds);
    const wordRecordCache: Record<string, VocabularyListWordRow> = {};
    for (const row of hydratedRecords) {
      wordRecordCache[row.id] = row;
    }

    const canonicalWordIdByLessonWordId: Record<string, string> = {};
    const lessonWords = hydratedRecords
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((row) => {
        const lessonWordId = randomUUID();
        canonicalWordIdByLessonWordId[lessonWordId] = row.id;
        return { id: lessonWordId };
      });

    const hydration = this.buildHydration(
      session,
      new Map(Object.entries(canonicalWordIdByLessonWordId))
    );
    const lastLoadedPosition =
      hydratedRecords.length > 0
        ? Math.max(...hydratedRecords.map((row) => row.position))
        : 0;

    const lessonState = new VocabularyLessonState(
      lessonWords,
      session.totalWordCount,
      createVocabularyLessonRandom(randomSeed),
      hydration
    );

    const firstStep = lessonState.next();
    if (firstStep.kind === "lesson-complete") {
      return null;
    }

    const capabilityId = randomUUID();
    const expiresAt = this.expiry();

    const lessonSnapshot: LessonRuntimeSnapshot = {
      schemaVersion: 1,
      userId,
      learningId,
      listId: session.listId,
      sessionId: session.sessionId,
      randomSeed,
      lessonState: lessonState.exportSnapshot(),
      canonicalWordIdByLessonWordId,
      wordRecordCache,
      lastLoadedPosition,
      refillsFulfilled: 0,
      lastRefillResult: null,
    };
    const capabilitySnapshot: CapabilityRuntimeSnapshot = {
      schemaVersion: 1,
      userId,
      lessonId,
      listId: session.listId,
      step: firstStep,
      predecessor: null,
      nextCapability: null,
      contentResponse: null,
    };

    await this.runtimeStore.createLessonAndCapability({
      lessonId,
      userId,
      listId: session.listId,
      expiresAt,
      lessonSnapshot,
      capabilityId,
      capabilitySnapshot,
    });

    return {
      contentType: "manifest",
      lessonId,
      randomSeed,
      nextCapability: capabilityId,
      words: lessonWords,
      totalWordCount: session.totalWordCount,
      progress: session.progress,
      hydratedProgressByWordId: Object.fromEntries(hydration.progressByWordId),
      checkpointEligibleWordIdOrder: [...hydration.checkpointEligibleOrder],
      servedCheckpointGroupCount: hydration.servedCheckpointGroupCount,
    };
  }

  async authorizeContent(
    userId: string,
    lessonId: string,
    capability: string,
    contentType: VocabularyScreenContentType,
    exampleIndex?: number
  ): Promise<AuthorizedVocabularyContent | null> {
    const loadedLesson = await this.loadValidLesson(lessonId);
    if (!loadedLesson || loadedLesson.snapshot.userId !== userId) {
      return null;
    }

    const loadedCapability = await this.runtimeStore.loadCapability(capability);
    if (!loadedCapability) {
      return null;
    }

    let lesson = loadedLesson.snapshot;
    let record = loadedCapability.snapshot;

    if (
      record.userId !== userId ||
      record.lessonId !== lessonId ||
      record.listId !== lesson.listId ||
      !record.step ||
      contentTypeForStep(record.step) !== contentType ||
      (record.step.kind === "answer-recap" &&
        record.step.exampleIndex !== exampleIndex)
    ) {
      return null;
    }

    if (!(await this.learningSource.authorize(userId, lesson.learningId))) {
      return null;
    }

    if (!record.nextCapability) {
      const advanced = await this.advanceCapability(
        userId,
        lessonId,
        lesson,
        loadedLesson.version,
        loadedLesson.expiresAt,
        capability,
        record,
        loadedCapability.version
      );
      if (!advanced) {
        throw new Error(
          "Vocabulary content authorization could not converge after a concurrent update."
        );
      }
      lesson = advanced.lesson;
      record = advanced.capability;
    }

    const step = record.step;
    if (!step) {
      return null;
    }

    if (step.kind === "word-search-checkpoint") {
      return {
        capability,
        lessonId,
        contentType,
        listId: record.listId,
        wordId: "",
        wordIds: step.wordIds.map((lessonWordId) =>
          this.requireCanonicalWordId(lesson, lessonWordId)
        ),
        nextCapability: record.nextCapability as string,
      };
    }

    return {
      capability,
      lessonId,
      contentType,
      listId: record.listId,
      wordId: this.requireCanonicalWordId(lesson, step.wordId),
      review: isPracticeStep(step) ? step.review : undefined,
      nextCapability: record.nextCapability as string,
    };
  }

  async getCachedContent(
    authorization: AuthorizedVocabularyContent
  ): Promise<VocabularyContentResponse | null> {
    const loaded = await this.runtimeStore.loadCapability(authorization.capability);
    return loaded?.snapshot.contentResponse ?? null;
  }

  async buildContent(
    authorization: AuthorizedVocabularyContent,
    exampleIndex?: number
  ): Promise<VocabularyContentBuildResult | null> {
    const loadedLesson = await this.loadValidLesson(authorization.lessonId);
    if (!loadedLesson) {
      return null;
    }

    let lesson = loadedLesson.snapshot;
    let wordIdsForContent = authorization.wordIds;
    if (authorization.contentType === "word-search-checkpoint") {
      const served = await this.learningSource.serveCheckpointGroup(lesson.learningId);
      if (!served) {
        return null;
      }
      wordIdsForContent = served;
      lesson = await this.ensureWordsCached(
        authorization.lessonId,
        loadedLesson.version,
        loadedLesson.expiresAt,
        lesson,
        served
      );
    } else {
      lesson = await this.ensureWordsCached(
        authorization.lessonId,
        loadedLesson.version,
        loadedLesson.expiresAt,
        lesson,
        [authorization.wordId]
      );
    }

    const activePoolLessonWordIds = this.getActivePoolWordIds(lesson);

    const context: VocabularyContentBuildContext = {
      getWord: (wordId) => lesson.wordRecordCache[wordId],
      getActiveDistractorCandidates: (excludeWordId) => {
        const canonicalIds = activePoolLessonWordIds
          .map((lessonWordId) => lesson.canonicalWordIdByLessonWordId[lessonWordId])
          .filter(
            (id): id is string => typeof id === "string" && id !== excludeWordId
          );
        return canonicalIds
          .map((id) => lesson.wordRecordCache[id])
          .filter((word): word is VocabularyListWordRow => Boolean(word));
      },
      findMoreDistractors: (excludeIds, count) =>
        this.listSource.findDistractors(lesson.listId, excludeIds, count),
      createDefinitionAttempt: async (listWordId, review, choices) => {
        const created = await this.learningSource.createDefinitionAttempt(
          lesson.learningId,
          lesson.sessionId,
          listWordId,
          review,
          choices
        );
        return {
          attemptId: created.attemptId,
          choiceIds: created.choices
            .slice()
            .sort((left, right) => left.position - right.position)
            .map((choice) => choice.id),
        };
      },
      createSpellingAttempt: async (listWordId, review, canonicalSpelling) => {
        const created = await this.learningSource.createSpellingAttempt(
          lesson.learningId,
          lesson.sessionId,
          listWordId,
          review,
          canonicalSpelling
        );
        return { attemptId: created.attemptId };
      },
    };

    return getVocabularyContent(
      { ...authorization, wordIds: wordIdsForContent, exampleIndex },
      context,
      this.randomInt
    );
  }

  async recordContentResponse(
    authorization: AuthorizedVocabularyContent,
    built: VocabularyContentBuildResult
  ): Promise<void> {
    const loadedCapability = await this.runtimeStore.loadCapability(authorization.capability);
    if (
      !loadedCapability ||
      loadedCapability.snapshot.lessonId !== authorization.lessonId ||
      loadedCapability.snapshot.contentResponse
    ) {
      return;
    }
    const record = loadedCapability.snapshot;

    const loadedLesson = await this.loadValidLesson(authorization.lessonId);
    if (!loadedLesson) {
      return;
    }

    // `getVocabularyContent` never returns "manifest" or "word-refill" for a
    // capability-scoped build, matching `VocabularyCapabilityContentResponse`.
    const contentResponse = built.content as VocabularyCapabilityContentResponse;
    const updatedCapability: CapabilityRuntimeSnapshot = {
      ...record,
      contentResponse,
    };

    if (
      built.content.contentType !== "definition-practice" &&
      built.content.contentType !== "spelling-practice"
    ) {
      await this.runtimeStore.recordContent({
        lessonExpiresAt: loadedLesson.expiresAt,
        capabilityId: authorization.capability,
        expectedCapabilityVersion: loadedCapability.version,
        capabilitySnapshot: updatedCapability,
        lessonUpdate: null,
      });
      return;
    }

    const lessonState = VocabularyLessonState.restoreFromSnapshot(
      loadedLesson.snapshot.lessonState,
      loadedLesson.snapshot.randomSeed
    );
    const wordId = this.requireLessonWordId(loadedLesson.snapshot, authorization.wordId);
    lessonState.activateAttempt({
      wordId,
      answerType:
        built.content.contentType === "definition-practice"
          ? "definition"
          : "spelling",
      attemptId: built.content.attemptId,
      validChoiceIds:
        built.content.contentType === "definition-practice"
          ? built.content.choices.map((choice) => choice.id)
          : [],
      review: authorization.review ?? false,
    });

    const updatedLessonSnapshot: LessonRuntimeSnapshot = {
      ...loadedLesson.snapshot,
      lessonState: lessonState.exportSnapshot(),
    };

    const attemptIndex = record.nextCapability
      ? {
          attemptId: built.content.attemptId,
          userId: record.userId,
          listId: record.listId,
          snapshot: {
            schemaVersion: 1 as const,
            lessonId: record.lessonId,
            successorCapability: record.nextCapability,
          },
        }
      : null;

    await this.runtimeStore.recordContent({
      lessonExpiresAt: loadedLesson.expiresAt,
      capabilityId: authorization.capability,
      expectedCapabilityVersion: loadedCapability.version,
      capabilitySnapshot: updatedCapability,
      lessonUpdate: {
        lessonId: authorization.lessonId,
        expectedVersion: loadedLesson.version,
        snapshot: updatedLessonSnapshot,
        attemptIndex,
      },
    });
  }

  /**
   * Authorized refill loading: fetches exactly one next ordered database
   * word once server-authoritative lesson state confirms a slot is due.
   * Concurrent/repeated calls for the same due slot are resolved by an
   * optimistic compare-and-swap loop over the shared runtime record: a
   * losing writer re-reads the committed lesson and replays its recorded
   * outcome instead of advancing the ordered cursor again.
   */
  async refillNextWord(
    userId: string,
    lessonId: string
  ): Promise<RefillOutcome | null> {
    const loaded = await this.loadValidLesson(lessonId);
    if (!loaded || loaded.snapshot.userId !== userId) {
      return null;
    }
    if (!(await this.learningSource.authorize(userId, loaded.snapshot.learningId))) {
      return null;
    }

    let lesson = loaded.snapshot;
    let version = loaded.version;
    const due = lesson.lessonState.checkpointEligibleOrder.length;
    if (lesson.refillsFulfilled >= due) {
      return lesson.lastRefillResult ?? { wordId: null };
    }

    for (let attempt = 0; attempt < MAX_CONCURRENCY_RETRIES; attempt += 1) {
      const row = await this.listSource.findNext(lesson.listId, lesson.lastLoadedPosition);

      let outcome: RefillOutcome;
      let updatedSnapshot: LessonRuntimeSnapshot;
      if (!row) {
        outcome = { wordId: null };
        updatedSnapshot = {
          ...lesson,
          refillsFulfilled: lesson.refillsFulfilled + 1,
          lastRefillResult: outcome,
        };
      } else {
        const lessonWordId = randomUUID();
        const lessonState = VocabularyLessonState.restoreFromSnapshot(
          lesson.lessonState,
          lesson.randomSeed
        );
        lessonState.appendWord({ id: lessonWordId });
        outcome = { wordId: lessonWordId };
        updatedSnapshot = {
          ...lesson,
          lessonState: lessonState.exportSnapshot(),
          canonicalWordIdByLessonWordId: {
            ...lesson.canonicalWordIdByLessonWordId,
            [lessonWordId]: row.id,
          },
          wordRecordCache: { ...lesson.wordRecordCache, [row.id]: row },
          lastLoadedPosition: row.position,
          refillsFulfilled: lesson.refillsFulfilled + 1,
          lastRefillResult: outcome,
        };
      }

      const ok = await this.runtimeStore.updateLesson({
        lessonId,
        expectedVersion: version,
        snapshot: updatedSnapshot,
        expiresAt: loaded.expiresAt,
      });
      if (ok) {
        return outcome;
      }

      const reloaded = await this.runtimeStore.loadLesson(lessonId);
      if (!reloaded) {
        return null;
      }
      lesson = reloaded.snapshot;
      version = reloaded.version;
      if (lesson.refillsFulfilled >= due) {
        return lesson.lastRefillResult ?? { wordId: null };
      }
    }

    throw new Error("Vocabulary refill could not converge after a concurrent update.");
  }

  async resolveAnswer(
    userId: string,
    submission: VocabularyAnswerSubmission
  ): Promise<VocabularyAnswerApiResult | null> {
    const commit = await this.learningSource.commitAnswer(userId, submission);
    if (commit.status !== "ok") {
      return null;
    }

    const result = toLegacyResult(submission, commit);
    const index = await this.runtimeStore.loadAttemptIndex(submission.attemptId);

    if (index) {
      try {
        const loadedLesson = await this.runtimeStore.loadLesson(index.lessonId);
        const loadedCapability = await this.runtimeStore.loadCapability(
          index.successorCapability
        );
        if (
          loadedLesson &&
          !this.isExpired(loadedLesson.expiresAt) &&
          loadedCapability &&
          !loadedCapability.snapshot.step
        ) {
          const lessonState = VocabularyLessonState.restoreFromSnapshot(
            loadedLesson.snapshot.lessonState,
            loadedLesson.snapshot.randomSeed
          );
          lessonState.beginSubmission(submission);
          lessonState.recordSubmission(result);
          const nextStep = lessonState.next();

          const updatedLessonSnapshot: LessonRuntimeSnapshot = {
            ...loadedLesson.snapshot,
            lessonState: lessonState.exportSnapshot(),
          };
          const updatedCapabilitySnapshot: CapabilityRuntimeSnapshot = {
            ...loadedCapability.snapshot,
            step: nextStep.kind === "lesson-complete" ? null : nextStep,
          };

          const ok = await this.runtimeStore.resolveAnswerAdvance({
            attemptId: submission.attemptId,
            lessonExpiresAt: loadedLesson.expiresAt,
            lessonId: index.lessonId,
            expectedLessonVersion: loadedLesson.version,
            lessonSnapshot: updatedLessonSnapshot,
            capabilityId: index.successorCapability,
            expectedCapabilityVersion: loadedCapability.version,
            capabilitySnapshot: updatedCapabilitySnapshot,
          });
          if (!ok) {
            await this.runtimeStore.deleteAttemptIndex(submission.attemptId);
          }
        } else {
          await this.runtimeStore.deleteAttemptIndex(submission.attemptId);
        }
      } catch (error) {
        // The durable answer already committed successfully; a mirror
        // desync only degrades in-process screen sequencing, which the
        // learner recovers from by reopening the lesson.
        console.warn("vocabulary_sequencer_mirror_desync", error);
        await this.runtimeStore.deleteAttemptIndex(submission.attemptId).catch(() => undefined);
      }
    }

    return { ...result, progress: commit.progress };
  }

  /**
   * Resolves the `authorizeContent` "advance past the current screen"
   * transition with a bounded optimistic compare-and-swap retry: a losing
   * writer re-reads the committed capability/lesson and either replays a
   * concurrent winner's already-advanced result or recomputes the
   * transition from the freshly committed lesson state.
   */
  private async advanceCapability(
    userId: string,
    lessonId: string,
    initialLesson: LessonRuntimeSnapshot,
    initialLessonVersion: number,
    lessonExpiresAt: number,
    capabilityId: string,
    initialRecord: CapabilityRuntimeSnapshot,
    initialCapabilityVersion: number
  ): Promise<{ lesson: LessonRuntimeSnapshot; capability: CapabilityRuntimeSnapshot } | null> {
    let lesson = initialLesson;
    let lessonVersion = initialLessonVersion;
    let record = initialRecord;
    let capabilityVersion = initialCapabilityVersion;

    for (let attempt = 0; attempt < MAX_CONCURRENCY_RETRIES; attempt += 1) {
      const step = record.step;
      if (!step) {
        return null;
      }

      if (step.kind === "definition-fun-fact") {
        await this.learningSource.markIntroduced(
          lesson.learningId,
          lesson.sessionId,
          this.requireCanonicalWordId(lesson, step.wordId)
        );
      }

      const newCapabilityId = randomUUID();
      let lessonUpdate: { expectedVersion: number; snapshot: LessonRuntimeSnapshot } | null =
        null;
      let newStep: ScreenStep | null;

      if (isPracticeStep(step)) {
        newStep = null;
      } else {
        const lessonState = VocabularyLessonState.restoreFromSnapshot(
          lesson.lessonState,
          lesson.randomSeed
        );
        const nextStep = lessonState.next();
        newStep = nextStep.kind === "lesson-complete" ? null : nextStep;
        lessonUpdate = {
          expectedVersion: lessonVersion,
          snapshot: { ...lesson, lessonState: lessonState.exportSnapshot() },
        };
      }

      const newCapabilitySnapshot: CapabilityRuntimeSnapshot = {
        schemaVersion: 1,
        userId,
        lessonId,
        listId: record.listId,
        step: newStep,
        predecessor: capabilityId,
        nextCapability: null,
        contentResponse: null,
      };
      const updatedRecord: CapabilityRuntimeSnapshot = {
        ...record,
        nextCapability: newCapabilityId,
      };

      const ok = await this.runtimeStore.advanceCapability({
        lessonId,
        listId: record.listId,
        userId,
        lessonExpiresAt,
        capabilityId,
        expectedCapabilityVersion: capabilityVersion,
        capabilitySnapshot: updatedRecord,
        newCapability: { id: newCapabilityId, snapshot: newCapabilitySnapshot },
        retireCapabilityId: record.predecessor,
        lessonUpdate,
      });

      if (ok) {
        return {
          lesson: lessonUpdate ? lessonUpdate.snapshot : lesson,
          capability: updatedRecord,
        };
      }

      const reloadedCapability = await this.runtimeStore.loadCapability(capabilityId);
      if (!reloadedCapability) {
        return null;
      }
      record = reloadedCapability.snapshot;
      capabilityVersion = reloadedCapability.version;

      if (record.nextCapability) {
        // A concurrent winner already committed this exact transition;
        // return its result instead of creating a second successor.
        const reloadedLesson = await this.runtimeStore.loadLesson(lessonId);
        return {
          lesson: reloadedLesson ? reloadedLesson.snapshot : lesson,
          capability: record,
        };
      }

      const reloadedLesson = await this.runtimeStore.loadLesson(lessonId);
      if (!reloadedLesson) {
        return null;
      }
      lesson = reloadedLesson.snapshot;
      lessonVersion = reloadedLesson.version;
    }

    return null;
  }

  private async ensureWordsCached(
    lessonId: string,
    lessonVersion: number,
    lessonExpiresAt: number,
    lesson: LessonRuntimeSnapshot,
    canonicalWordIds: readonly string[]
  ): Promise<LessonRuntimeSnapshot> {
    const missing = canonicalWordIds.filter((id) => !(id in lesson.wordRecordCache));
    if (missing.length === 0) {
      return lesson;
    }
    const rows = await this.listSource.findByIds(lesson.listId, missing);
    if (rows.length === 0) {
      return lesson;
    }

    const updatedSnapshot: LessonRuntimeSnapshot = {
      ...lesson,
      wordRecordCache: { ...lesson.wordRecordCache, ...Object.fromEntries(rows.map((row) => [row.id, row])) },
    };
    // Best-effort: a lost race here only means a future request re-fetches
    // the same rows, so the freshly fetched cache is used for this request
    // either way.
    await this.runtimeStore.updateLesson({
      lessonId,
      expectedVersion: lessonVersion,
      snapshot: updatedSnapshot,
      expiresAt: lessonExpiresAt,
    });
    return updatedSnapshot;
  }

  /**
   * Bounds the initial content fetch to what the learner has actually
   * reached: the first ACTIVE_POOL_SIZE words for a brand-new learning, or
   * (for a resumed one) every word up through the highest position with any
   * recorded progress, so due reviews for already-mastered words stay
   * reconstructable without loading the entire list's canonical content.
   */
  private selectHydrationWordIds(session: VocabularyLearningSession): string[] {
    const touchedPositions = session.progressRows
      .filter(
        (row) =>
          row.introduced ||
          row.totalCorrect > 0 ||
          row.totalIncorrect > 0 ||
          row.spellingMastered
      )
      .map((row) => row.position);
    const orderedPositions = session.progressRows
      .map((row) => row.position)
      .sort((left, right) => left - right);
    const defaultBoundaryIndex = Math.min(ACTIVE_POOL_SIZE, orderedPositions.length) - 1;
    const minimumBoundaryPosition = orderedPositions[defaultBoundaryIndex] ?? 0;
    const boundaryPosition = Math.max(minimumBoundaryPosition, ...touchedPositions, 0);
    return session.progressRows
      .filter((row) => row.position <= boundaryPosition)
      .map((row) => row.listWordId);
  }

  private buildHydration(
    session: VocabularyLearningSession,
    canonicalWordIdByLessonWordId: ReadonlyMap<string, string>
  ): VocabularyLessonHydration {
    const lessonWordIdByCanonicalId = new Map<string, string>();
    for (const [lessonWordId, canonicalId] of canonicalWordIdByLessonWordId) {
      lessonWordIdByCanonicalId.set(canonicalId, lessonWordId);
    }

    const progressByWordId = new Map<string, VocabularyWordProgress>();
    const checkpointEligibleOrder: string[] = [];
    const masteredInOrder = session.progressRows
      .filter((row) => row.initialMasterySequence !== null)
      .sort(
        (left, right) => (left.initialMasterySequence ?? 0) - (right.initialMasterySequence ?? 0)
      );

    for (const row of session.progressRows) {
      const lessonWordId = lessonWordIdByCanonicalId.get(row.listWordId);
      if (!lessonWordId) {
        continue;
      }
      progressByWordId.set(lessonWordId, {
        introduced: row.introduced,
        definitionConsecutiveCorrect: row.definitionConsecutiveCorrect,
        definitionMastered: row.definitionMastered,
        spellingConsecutiveCorrect: row.spellingConsecutiveCorrect,
        spellingMastered: row.spellingMastered,
        practicePresentationCount: row.practicePresentationCount,
        reviewStage: fromDurableReviewStage(row.reviewStage),
        nextReviewQuestionNumber: row.nextReviewQuestionNumber,
      });
    }
    for (const row of masteredInOrder) {
      const lessonWordId = lessonWordIdByCanonicalId.get(row.listWordId);
      if (lessonWordId) {
        checkpointEligibleOrder.push(lessonWordId);
      }
    }

    return {
      progressByWordId,
      gradedAnswerCount: session.progress.gradedAnswerCount,
      correctCount: session.progress.correctAnswerCount,
      incorrectCount: session.progress.incorrectAnswerCount,
      checkpointEligibleOrder,
      servedCheckpointGroupCount: session.servedCheckpointGroupCount,
    };
  }

  private getActivePoolWordIds(lesson: LessonRuntimeSnapshot): string[] {
    return VocabularyLessonState.restoreFromSnapshot(
      lesson.lessonState,
      lesson.randomSeed
    ).getActivePoolWordIds();
  }

  private requireCanonicalWordId(
    lesson: LessonRuntimeSnapshot,
    lessonWordId: string
  ): string {
    const wordId = lesson.canonicalWordIdByLessonWordId[lessonWordId];
    if (!wordId) {
      throw new Error("Vocabulary lesson word capability is invalid.");
    }
    return wordId;
  }

  private requireLessonWordId(lesson: LessonRuntimeSnapshot, canonicalWordId: string): string {
    for (const [lessonWordId, candidate] of Object.entries(
      lesson.canonicalWordIdByLessonWordId
    )) {
      if (candidate === canonicalWordId) {
        return lessonWordId;
      }
    }
    throw new Error("Vocabulary lesson word capability is invalid.");
  }

  private expiry(): number {
    return this.now() + this.lifetimeMs;
  }

  private isExpired(expiresAt: number): boolean {
    return expiresAt <= this.now();
  }

  /**
   * Loads a lesson and lazily invalidates it once its fixed, non-sliding
   * expiry has passed, removing every runtime record for that lesson (its
   * capability and attempt-index rows included) so they become unusable
   * exactly as the former in-memory expiry sweep guaranteed.
   */
  private async loadValidLesson(lessonId: string): Promise<LoadedLessonRecord | null> {
    const loaded = await this.runtimeStore.loadLesson(lessonId);
    if (!loaded) {
      return null;
    }
    if (this.isExpired(loaded.expiresAt)) {
      await this.runtimeStore.purgeLessonRecords(lessonId);
      return null;
    }
    return loaded;
  }
}

function contentTypeForStep(step: ScreenStep): VocabularyScreenContentType {
  return step.kind;
}

function isPracticeStep(
  step: ScreenStep
): step is Extract<
  ScreenStep,
  { kind: "definition-practice" | "spelling-practice" }
> {
  return (
    step.kind === "definition-practice" || step.kind === "spelling-practice"
  );
}

function fromDurableReviewStage(
  stage: "IDLE" | "DEFINITION_PENDING" | "SPELLING_PENDING"
): VocabularyWordProgress["reviewStage"] {
  switch (stage) {
    case "DEFINITION_PENDING":
      return "definition-pending";
    case "SPELLING_PENDING":
      return "spelling-pending";
    case "IDLE":
    default:
      return "idle";
  }
}

function toLegacyResult(
  submission: VocabularyAnswerSubmission,
  commit: Extract<VocabularyCommitResult, { status: "ok" }>
): VocabularyAnswerResult {
  if (submission.answerType === "definition") {
    return {
      answerType: "definition",
      correctChoiceId: commit.correctChoiceId ?? "",
    };
  }
  return commit.correct
    ? { answerType: "spelling", correct: true }
    : { answerType: "spelling", correct: false, correctAnswer: commit.correctAnswer ?? "" };
}

export const vocabularyContentCapabilityStore =
  new VocabularyContentCapabilityStore();
