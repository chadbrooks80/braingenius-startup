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
import type { VocabularyLessonStep, VocabularyWordProgress } from "../state/VocabularyLessonTypes";
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

const DEFAULT_LIFETIME_MS = 30 * 60 * 1_000;

type ScreenStep = Exclude<VocabularyLessonStep, { kind: "lesson-complete" }>;

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

type LessonRecord = {
  userId: string;
  learningId: string;
  listId: string;
  sessionId: string;
  expiresAt: number;
  state: VocabularyLessonState;
  canonicalWordIdByLessonWordId: Map<string, string>;
  wordRecordCache: Map<string, VocabularyListWordRow>;
  lastLoadedPosition: number;
  refillsFulfilled: number;
  lastRefillResult: RefillOutcome | null;
  refillInFlight: Promise<RefillOutcome> | null;
};

type CapabilityRecord = {
  userId: string;
  lessonId: string;
  listId: string;
  step: ScreenStep | null;
  predecessor: string | null;
  nextCapability: string | null;
  contentResponse: VocabularyContentResponse | null;
  expiresAt: number;
};

// A lightweight, disposable index from a durable attempt ID to the
// in-process lesson/successor it belongs to, used only to advance the
// screen-sequencing mirror after a durable grade commits. If this process
// restarts mid-attempt, the answer is still durably graded and progress is
// never lost; only the in-memory capability chain is discarded, exactly as
// already documented for this store, and the learner simply reopens the
// lesson to continue from saved progress.
type AttemptIndexRecord = {
  lessonId: string;
  successorCapability: string;
};

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
};

export class VocabularyContentCapabilityStore {
  private readonly lessons = new Map<string, LessonRecord>();
  private readonly capabilities = new Map<string, CapabilityRecord>();
  private readonly attemptIndex = new Map<string, AttemptIndexRecord>();
  private readonly now: () => number;
  private readonly lifetimeMs: number;
  private readonly seed: () => number;
  private readonly randomInt: (maxExclusive: number) => number;
  private readonly listSource: VocabularyListSource;
  private readonly learningSource: VocabularyLearningSource;

  constructor(options: CapabilityStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.lifetimeMs = options.lifetimeMs ?? DEFAULT_LIFETIME_MS;
    this.seed = options.seed ?? (() => secureRandomInt(4_294_967_296));
    this.randomInt = options.randomInt ?? secureRandomInt;
    this.listSource = options.listSource ?? defaultVocabularyListSource;
    this.learningSource = options.learningSource ?? defaultVocabularyLearningSource;
  }

  async createManifest(
    userId: string,
    learningId: string
  ): Promise<VocabularyLessonManifest | null> {
    this.removeExpiredRecords();
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
    const wordRecordCache = new Map<string, VocabularyListWordRow>(
      hydratedRecords.map((row) => [row.id, row])
    );

    const canonicalWordIdByLessonWordId = new Map<string, string>();
    const lessonWords = hydratedRecords
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((row) => {
        const lessonWordId = randomUUID();
        canonicalWordIdByLessonWordId.set(lessonWordId, row.id);
        return { id: lessonWordId };
      });

    const hydration = this.buildHydration(session, canonicalWordIdByLessonWordId);
    const lastLoadedPosition =
      hydratedRecords.length > 0
        ? Math.max(...hydratedRecords.map((row) => row.position))
        : 0;

    const lesson: LessonRecord = {
      userId,
      learningId,
      listId: session.listId,
      sessionId: session.sessionId,
      expiresAt: this.expiry(),
      state: new VocabularyLessonState(
        lessonWords,
        session.totalWordCount,
        createVocabularyLessonRandom(randomSeed),
        hydration
      ),
      canonicalWordIdByLessonWordId,
      wordRecordCache,
      lastLoadedPosition,
      refillsFulfilled: 0,
      lastRefillResult: null,
      refillInFlight: null,
    };
    this.lessons.set(lessonId, lesson);

    const firstStep = lesson.state.next();
    if (firstStep.kind === "lesson-complete") {
      this.lessons.delete(lessonId);
      return null;
    }
    const nextCapability = this.issueCapability(
      userId,
      lessonId,
      session.listId,
      firstStep,
      null
    );

    return {
      contentType: "manifest",
      lessonId,
      randomSeed,
      nextCapability,
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
    this.removeExpiredRecords();
    const lesson = this.lessons.get(lessonId);
    const record = this.capabilities.get(capability);
    if (
      !lesson ||
      !record ||
      lesson.userId !== userId ||
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
      if (record.predecessor) {
        this.retireCapability(record.predecessor);
      }

      if (record.step.kind === "definition-fun-fact") {
        await this.learningSource.markIntroduced(
          lesson.learningId,
          lesson.sessionId,
          this.requireCanonicalWordId(lesson, record.step.wordId)
        );
      }

      if (isPracticeStep(record.step)) {
        record.nextCapability = this.issueCapability(
          userId,
          lessonId,
          record.listId,
          null,
          capability
        );
      } else {
        const nextStep = lesson.state.next();
        record.nextCapability = this.issueCapability(
          userId,
          lessonId,
          record.listId,
          nextStep.kind === "lesson-complete" ? null : nextStep,
          capability
        );
      }
    }

    if (record.step.kind === "word-search-checkpoint") {
      return {
        capability,
        lessonId,
        contentType,
        listId: record.listId,
        wordId: "",
        wordIds: record.step.wordIds.map((lessonWordId) =>
          this.requireCanonicalWordId(lesson, lessonWordId)
        ),
        nextCapability: record.nextCapability,
      };
    }

    return {
      capability,
      lessonId,
      contentType,
      listId: record.listId,
      wordId: this.requireCanonicalWordId(lesson, record.step.wordId),
      review: isPracticeStep(record.step) ? record.step.review : undefined,
      nextCapability: record.nextCapability,
    };
  }

  getCachedContent(
    authorization: AuthorizedVocabularyContent
  ): VocabularyContentResponse | null {
    return (
      this.capabilities.get(authorization.capability)?.contentResponse ?? null
    );
  }

  async buildContent(
    authorization: AuthorizedVocabularyContent,
    exampleIndex?: number
  ): Promise<VocabularyContentBuildResult | null> {
    const lesson = this.lessons.get(authorization.lessonId);
    if (!lesson) {
      return null;
    }

    let wordIdsForContent = authorization.wordIds;
    if (authorization.contentType === "word-search-checkpoint") {
      const served = await this.learningSource.serveCheckpointGroup(lesson.learningId);
      if (!served) {
        return null;
      }
      wordIdsForContent = served;
      await this.ensureWordsCached(lesson, served);
    } else {
      await this.ensureWordsCached(lesson, [authorization.wordId]);
    }

    const context: VocabularyContentBuildContext = {
      getWord: (wordId) => lesson.wordRecordCache.get(wordId),
      getActiveDistractorCandidates: (excludeWordId) => {
        const canonicalIds = lesson.state
          .getActivePoolWordIds()
          .map((lessonWordId) =>
            lesson.canonicalWordIdByLessonWordId.get(lessonWordId)
          )
          .filter(
            (id): id is string => typeof id === "string" && id !== excludeWordId
          );
        return canonicalIds
          .map((id) => lesson.wordRecordCache.get(id))
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

  recordContentResponse(
    authorization: AuthorizedVocabularyContent,
    built: VocabularyContentBuildResult
  ): void {
    const record = this.capabilities.get(authorization.capability);
    const lesson = this.lessons.get(record?.lessonId ?? "");
    if (!record || !lesson || record.contentResponse) {
      return;
    }
    record.contentResponse = built.content;

    if (
      built.content.contentType !== "definition-practice" &&
      built.content.contentType !== "spelling-practice"
    ) {
      return;
    }

    const wordId = this.requireLessonWordId(lesson, authorization.wordId);
    lesson.state.activateAttempt({
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

    if (record.nextCapability) {
      this.attemptIndex.set(built.content.attemptId, {
        lessonId: record.lessonId,
        successorCapability: record.nextCapability,
      });
    }
  }

  /**
   * Authorized refill loading: fetches exactly one next ordered database
   * word once server-authoritative lesson state confirms a slot is due.
   * Concurrent/repeated calls for the same due slot share one in-flight
   * fetch, and a call with nothing newly due replays the last recorded
   * outcome instead of advancing the ordered cursor again.
   */
  async refillNextWord(
    userId: string,
    lessonId: string
  ): Promise<RefillOutcome | null> {
    this.removeExpiredRecords();
    const lesson = this.lessons.get(lessonId);
    if (!lesson || lesson.userId !== userId) {
      return null;
    }
    if (!(await this.learningSource.authorize(userId, lesson.learningId))) {
      return null;
    }

    if (lesson.refillInFlight) {
      return lesson.refillInFlight;
    }

    const due = lesson.state.getFirstMasteryCount();
    if (lesson.refillsFulfilled >= due) {
      return lesson.lastRefillResult ?? { wordId: null };
    }

    const task = (async (): Promise<RefillOutcome> => {
      try {
        const row = await this.listSource.findNext(
          lesson.listId,
          lesson.lastLoadedPosition
        );
        if (!row) {
          lesson.refillsFulfilled += 1;
          lesson.lastRefillResult = { wordId: null };
          return lesson.lastRefillResult;
        }

        const lessonWordId = randomUUID();
        lesson.canonicalWordIdByLessonWordId.set(lessonWordId, row.id);
        lesson.wordRecordCache.set(row.id, row);
        lesson.state.appendWord({ id: lessonWordId });
        lesson.lastLoadedPosition = row.position;
        lesson.refillsFulfilled += 1;
        lesson.lastRefillResult = { wordId: lessonWordId };
        return lesson.lastRefillResult;
      } finally {
        lesson.refillInFlight = null;
      }
    })();
    lesson.refillInFlight = task;
    return task;
  }

  async resolveAnswer(
    userId: string,
    submission: VocabularyAnswerSubmission
  ): Promise<VocabularyAnswerApiResult | null> {
    this.removeExpiredRecords();

    const commit = await this.learningSource.commitAnswer(userId, submission);
    if (commit.status !== "ok") {
      return null;
    }

    const result = toLegacyResult(submission, commit);

    const index = this.attemptIndex.get(submission.attemptId);
    if (index) {
      const lesson = this.lessons.get(index.lessonId);
      const successor = this.capabilities.get(index.successorCapability);
      if (lesson && successor && !successor.step) {
        try {
          lesson.state.beginSubmission(submission);
          lesson.state.recordSubmission(result);
          const nextStep = lesson.state.next();
          successor.step = nextStep.kind === "lesson-complete" ? null : nextStep;
        } catch (error) {
          // The durable answer already committed successfully; a mirror
          // desync only degrades in-process screen sequencing, which the
          // learner recovers from by reopening the lesson.
          console.warn("vocabulary_sequencer_mirror_desync", error);
        }
      }
      this.attemptIndex.delete(submission.attemptId);
    }

    return { ...result, progress: commit.progress };
  }

  private async ensureWordsCached(
    lesson: LessonRecord,
    canonicalWordIds: readonly string[]
  ): Promise<void> {
    const missing = canonicalWordIds.filter((id) => !lesson.wordRecordCache.has(id));
    if (missing.length === 0) {
      return;
    }
    const rows = await this.listSource.findByIds(lesson.listId, missing);
    for (const row of rows) {
      lesson.wordRecordCache.set(row.id, row);
    }
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

  private issueCapability(
    userId: string,
    lessonId: string,
    listId: string,
    step: ScreenStep | null,
    predecessor: string | null
  ): string {
    const capability = randomUUID();
    this.capabilities.set(capability, {
      userId,
      lessonId,
      listId,
      step,
      predecessor,
      nextCapability: null,
      contentResponse: null,
      expiresAt: this.expiry(),
    });
    return capability;
  }

  private retireCapability(capability: string): void {
    this.capabilities.delete(capability);
  }

  private requireCanonicalWordId(
    lesson: LessonRecord,
    lessonWordId: string
  ): string {
    const wordId = lesson.canonicalWordIdByLessonWordId.get(lessonWordId);
    if (!wordId) {
      throw new Error("Vocabulary lesson word capability is invalid.");
    }
    return wordId;
  }

  private requireLessonWordId(lesson: LessonRecord, canonicalWordId: string): string {
    for (const [lessonWordId, candidate] of lesson.canonicalWordIdByLessonWordId) {
      if (candidate === canonicalWordId) {
        return lessonWordId;
      }
    }
    throw new Error("Vocabulary lesson word capability is invalid.");
  }

  private expiry(): number {
    return this.now() + this.lifetimeMs;
  }

  private removeExpiredRecords(): void {
    const now = this.now();
    for (const [lessonId, lesson] of this.lessons) {
      if (lesson.expiresAt <= now) {
        this.lessons.delete(lessonId);
      }
    }
    for (const [capability, record] of this.capabilities) {
      if (record.expiresAt <= now || !this.lessons.has(record.lessonId)) {
        this.capabilities.delete(capability);
      }
    }
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
