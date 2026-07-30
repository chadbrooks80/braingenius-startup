import "server-only";

import { randomInt as secureRandomInt, randomUUID } from "node:crypto";
import {
  countVocabularyListWords,
  findFirstVocabularyListWords,
  findNextVocabularyListWord,
  findVocabularyDistractorDefinitions,
  isVocabularyListOwnedByUser,
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
import { VocabularyLessonState } from "../state/VocabularyLessonState";
import type { VocabularyLessonStep } from "../state/VocabularyLessonTypes";
import { createVocabularyLessonRandom } from "../state/createVocabularyLessonRandom";
import type {
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "../types";

const DEFAULT_LIFETIME_MS = 30 * 60 * 1_000;

type ScreenStep = Exclude<VocabularyLessonStep, { kind: "lesson-complete" }>;

// Injected boundary to the module-owned `ModVocabList`/`ModVocabListWord`
// repository. Kept as a narrow interface (not the raw Prisma client or the
// exported repository functions directly) so tests can supply a fully
// deterministic in-memory double, matching the existing
// ttsUsageService/effective-subscription-tier convention.
export type VocabularyListSource = {
  isOwned(userId: string, listId: string): Promise<boolean>;
  countWords(listId: string): Promise<number>;
  findFirst(listId: string, take: number): Promise<VocabularyListWordRow[]>;
  findNext(
    listId: string,
    afterPosition: number
  ): Promise<VocabularyListWordRow | null>;
  findDistractors(
    listId: string,
    excludeIds: readonly string[],
    take: number
  ): Promise<VocabularyDistractorRow[]>;
};

const defaultVocabularyListSource: VocabularyListSource = {
  isOwned: (userId, listId) => isVocabularyListOwnedByUser(userId, listId),
  countWords: (listId) => countVocabularyListWords(listId),
  findFirst: (listId, take) => findFirstVocabularyListWords(listId, take),
  findNext: (listId, afterPosition) =>
    findNextVocabularyListWord(listId, afterPosition),
  findDistractors: (listId, excludeIds, take) =>
    findVocabularyDistractorDefinitions(listId, excludeIds, take),
};

type RefillOutcome = { wordId: string | null };

type LessonRecord = {
  learnerId: string;
  wordListId: string;
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
  learnerId: string;
  lessonId: string;
  wordListId: string;
  step: ScreenStep | null;
  predecessor: string | null;
  nextCapability: string | null;
  attemptId: string | null;
  contentResponse: VocabularyContentResponse | null;
  expiresAt: number;
};

type AttemptRecord = VocabularyGradableAttempt & {
  learnerId: string;
  lessonId: string;
  wordListId: string;
  lessonWordId: string;
  review: boolean;
  successorCapability: string;
  activated: boolean;
  status: "active" | "answered";
  submission: VocabularyAnswerSubmission | null;
  result: VocabularyAnswerResult | null;
  expiresAt: number;
};

export type AuthorizedVocabularyContent = {
  capability: string;
  lessonId: string;
  contentType: VocabularyScreenContentType;
  wordListId: string;
  // Empty for word-search-checkpoint, which projects wordIds instead.
  wordId: string;
  wordIds?: string[];
  nextCapability: string;
  attemptId: string | null;
};

// Everything a grading function needs, captured once at content-build time
// from the server-owned attempt/capability record. Grading never re-queries
// the database or recomputes distractors from a fresh request.
export type VocabularyGradableAttempt = {
  attemptId: string;
  answerType: VocabularyAnswerSubmission["answerType"];
  validChoiceIds: readonly string[];
  correctChoiceId: string | null;
  canonicalSpelling: string | null;
  speechDefinition: string | null;
};

type CapabilityStoreOptions = {
  now?: () => number;
  lifetimeMs?: number;
  seed?: () => number;
  randomInt?: (maxExclusive: number) => number;
  listSource?: VocabularyListSource;
};

export class VocabularyContentCapabilityStore {
  private readonly lessons = new Map<string, LessonRecord>();
  private readonly capabilities = new Map<string, CapabilityRecord>();
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly now: () => number;
  private readonly lifetimeMs: number;
  private readonly seed: () => number;
  private readonly randomInt: (maxExclusive: number) => number;
  private readonly listSource: VocabularyListSource;

  constructor(options: CapabilityStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.lifetimeMs = options.lifetimeMs ?? DEFAULT_LIFETIME_MS;
    this.seed = options.seed ?? (() => secureRandomInt(4_294_967_296));
    this.randomInt = options.randomInt ?? secureRandomInt;
    this.listSource = options.listSource ?? defaultVocabularyListSource;
  }

  async createManifest(
    learnerId: string,
    userId: string,
    wordListId: string
  ): Promise<VocabularyLessonManifest | null> {
    this.removeExpiredRecords();
    const owned = await this.listSource.isOwned(userId, wordListId);
    if (!owned) {
      return null;
    }

    const totalWordCount = await this.listSource.countWords(wordListId);
    const rows = await this.listSource.findFirst(wordListId, ACTIVE_POOL_SIZE);

    const lessonId = randomUUID();
    const randomSeed = this.seed() >>> 0;
    const canonicalWordIdByLessonWordId = new Map<string, string>();
    const wordRecordCache = new Map<string, VocabularyListWordRow>();
    const lessonWords = rows.map((row) => {
      const lessonWordId = randomUUID();
      canonicalWordIdByLessonWordId.set(lessonWordId, row.id);
      wordRecordCache.set(row.id, row);
      return { id: lessonWordId };
    });
    const lastLoadedPosition =
      rows.length > 0 ? rows[rows.length - 1].position : 0;

    const lesson: LessonRecord = {
      learnerId,
      wordListId,
      expiresAt: this.expiry(),
      state: new VocabularyLessonState(
        lessonWords,
        totalWordCount,
        createVocabularyLessonRandom(randomSeed)
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
      learnerId,
      lessonId,
      wordListId,
      firstStep,
      null
    );

    return {
      contentType: "manifest",
      lessonId,
      randomSeed,
      nextCapability,
      words: lessonWords,
      totalWordCount,
    };
  }

  async authorizeContent(
    learnerId: string,
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
      lesson.learnerId !== learnerId ||
      record.learnerId !== learnerId ||
      record.lessonId !== lessonId ||
      record.wordListId !== lesson.wordListId ||
      !record.step ||
      contentTypeForStep(record.step) !== contentType ||
      (record.step.kind === "answer-recap" &&
        record.step.exampleIndex !== exampleIndex)
    ) {
      return null;
    }

    if (!(await this.listSource.isOwned(userId, lesson.wordListId))) {
      return null;
    }

    if (!record.nextCapability) {
      if (record.predecessor) {
        this.retireCapability(record.predecessor);
      }

      if (isPracticeStep(record.step)) {
        const attemptId = randomUUID();
        record.attemptId = attemptId;
        record.nextCapability = this.issueCapability(
          learnerId,
          lessonId,
          record.wordListId,
          null,
          capability
        );
        this.attempts.set(attemptId, {
          learnerId,
          lessonId,
          wordListId: record.wordListId,
          lessonWordId: record.step.wordId,
          answerType:
            record.step.kind === "definition-practice"
              ? "definition"
              : "spelling",
          attemptId,
          review: record.step.review,
          successorCapability: record.nextCapability,
          activated: false,
          status: "active",
          submission: null,
          result: null,
          expiresAt: record.expiresAt,
          validChoiceIds: [],
          correctChoiceId: null,
          canonicalSpelling: null,
          speechDefinition: null,
        });
      } else {
        const nextStep = lesson.state.next();
        record.nextCapability = this.issueCapability(
          learnerId,
          lessonId,
          record.wordListId,
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
        wordListId: record.wordListId,
        wordId: "",
        wordIds: record.step.wordIds.map((lessonWordId) =>
          this.requireCanonicalWordId(lesson, lessonWordId)
        ),
        nextCapability: record.nextCapability,
        attemptId: record.attemptId,
      };
    }

    return {
      capability,
      lessonId,
      contentType,
      wordListId: record.wordListId,
      wordId: this.requireCanonicalWordId(lesson, record.step.wordId),
      nextCapability: record.nextCapability,
      attemptId: record.attemptId,
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
        this.listSource.findDistractors(lesson.wordListId, excludeIds, count),
    };

    return getVocabularyContent(
      { ...authorization, exampleIndex },
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

    if (!record.attemptId) {
      return;
    }
    const attempt = this.attempts.get(record.attemptId);
    if (!attempt || attempt.activated) {
      return;
    }

    if (built.answerSnapshot?.answerType === "definition") {
      attempt.correctChoiceId = built.answerSnapshot.correctChoiceId;
    } else if (built.answerSnapshot?.answerType === "spelling") {
      attempt.canonicalSpelling = built.answerSnapshot.canonicalSpelling;
      attempt.speechDefinition = built.answerSnapshot.speechDefinition;
    }

    const validChoiceIds =
      built.content.contentType === "definition-practice"
        ? built.content.choices.map((choice) => choice.id)
        : [];
    attempt.validChoiceIds = validChoiceIds;
    lesson.state.activateAttempt({
      wordId: attempt.lessonWordId,
      answerType: attempt.answerType,
      attemptId: attempt.attemptId,
      validChoiceIds,
      review: attempt.review,
    });
    attempt.activated = true;
  }

  /**
   * Authorized refill loading: fetches exactly one next ordered database
   * word once server-authoritative lesson state confirms a slot is due.
   * Concurrent/repeated calls for the same due slot share one in-flight
   * fetch, and a call with nothing newly due replays the last recorded
   * outcome instead of advancing the ordered cursor again.
   */
  async refillNextWord(
    learnerId: string,
    userId: string,
    lessonId: string
  ): Promise<RefillOutcome | null> {
    this.removeExpiredRecords();
    const lesson = this.lessons.get(lessonId);
    if (!lesson || lesson.learnerId !== learnerId) {
      return null;
    }
    if (!(await this.listSource.isOwned(userId, lesson.wordListId))) {
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
          lesson.wordListId,
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
    learnerId: string,
    userId: string,
    submission: VocabularyAnswerSubmission,
    grade: (
      attempt: VocabularyGradableAttempt,
      submission: VocabularyAnswerSubmission
    ) => VocabularyAnswerResult | null
  ): Promise<VocabularyAnswerResult | null> {
    this.removeExpiredRecords();
    const attempt = this.attempts.get(submission.attemptId);
    if (
      !attempt ||
      attempt.learnerId !== learnerId ||
      attempt.answerType !== submission.answerType ||
      !attempt.activated
    ) {
      return null;
    }

    if (!(await this.listSource.isOwned(userId, attempt.wordListId))) {
      return null;
    }

    if (attempt.status === "answered") {
      return equalSubmission(attempt.submission, submission)
        ? attempt.result
        : null;
    }

    const result = grade(attempt, submission);
    const lesson = this.lessons.get(attempt.lessonId);
    const successor = this.capabilities.get(attempt.successorCapability);
    if (!result || !lesson || !successor || successor.step) {
      return null;
    }

    lesson.state.beginSubmission(submission);
    lesson.state.recordSubmission(result);
    const nextStep = lesson.state.next();
    if (nextStep.kind === "lesson-complete") {
      return null;
    }
    successor.step = nextStep;
    attempt.status = "answered";
    attempt.submission = submission;
    attempt.result = result;
    return result;
  }

  async getSpellingAttempt(
    learnerId: string,
    userId: string,
    reference: string
  ): Promise<VocabularyGradableAttempt | null> {
    this.removeExpiredRecords();
    const attempt = this.attempts.get(reference);
    if (
      !attempt ||
      attempt.status !== "active" ||
      !attempt.activated ||
      attempt.learnerId !== learnerId ||
      attempt.answerType !== "spelling"
    ) {
      return null;
    }
    if (!(await this.listSource.isOwned(userId, attempt.wordListId))) {
      return null;
    }
    return attempt;
  }

  private issueCapability(
    learnerId: string,
    lessonId: string,
    wordListId: string,
    step: ScreenStep | null,
    predecessor: string | null
  ): string {
    const capability = randomUUID();
    this.capabilities.set(capability, {
      learnerId,
      lessonId,
      wordListId,
      step,
      predecessor,
      nextCapability: null,
      attemptId: null,
      contentResponse: null,
      expiresAt: this.expiry(),
    });
    return capability;
  }

  private retireCapability(capability: string): void {
    const record = this.capabilities.get(capability);
    if (!record) {
      return;
    }
    this.capabilities.delete(capability);
    if (record.attemptId) {
      this.attempts.delete(record.attemptId);
    }
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
    for (const [attemptId, attempt] of this.attempts) {
      if (attempt.expiresAt <= now || !this.lessons.has(attempt.lessonId)) {
        this.attempts.delete(attemptId);
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

function equalSubmission(
  left: VocabularyAnswerSubmission | null,
  right: VocabularyAnswerSubmission
): boolean {
  return left !== null && JSON.stringify(left) === JSON.stringify(right);
}

export const vocabularyContentCapabilityStore =
  new VocabularyContentCapabilityStore();
