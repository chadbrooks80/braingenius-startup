import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { getWordList } from "../data/getWordList";
import type {
  VocabularyContentResponse,
  VocabularyLessonManifest,
  VocabularyScreenContentType,
} from "../data/vocabularyContentTypes";
import { VocabularyLessonState } from "../state/VocabularyLessonState";
import type { VocabularyLessonStep } from "../state/VocabularyLessonTypes";
import { createVocabularyLessonRandom } from "../state/createVocabularyLessonRandom";
import type {
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "../types";

const DEFAULT_LIFETIME_MS = 30 * 60 * 1_000;

type ScreenStep = Exclude<VocabularyLessonStep, { kind: "lesson-complete" }>;

type LessonRecord = {
  learnerId: string;
  wordListId: string;
  expiresAt: number;
  state: VocabularyLessonState;
  canonicalWordIdByLessonWordId: Map<string, string>;
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

type AttemptRecord = VocabularyAttemptAuthorization & {
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
  contentType: VocabularyScreenContentType;
  wordListId: string;
  wordId: string;
  nextCapability: string;
  attemptId: string | null;
};

export type VocabularyAttemptAuthorization = {
  learnerId: string;
  lessonId: string;
  wordListId: string;
  wordId: string;
  answerType: VocabularyAnswerSubmission["answerType"];
  attemptId: string;
};

type CapabilityStoreOptions = {
  now?: () => number;
  lifetimeMs?: number;
  seed?: () => number;
};

export class VocabularyContentCapabilityStore {
  private readonly lessons = new Map<string, LessonRecord>();
  private readonly capabilities = new Map<string, CapabilityRecord>();
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly now: () => number;
  private readonly lifetimeMs: number;
  private readonly seed: () => number;

  constructor(options: CapabilityStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.lifetimeMs = options.lifetimeMs ?? DEFAULT_LIFETIME_MS;
    this.seed = options.seed ?? (() => randomInt(4_294_967_296));
  }

  createManifest(
    learnerId: string,
    wordListId: string
  ): VocabularyLessonManifest | null {
    this.removeExpiredRecords();
    const words = getWordList(wordListId);
    if (!words) {
      return null;
    }

    const lessonId = randomUUID();
    const randomSeed = this.seed() >>> 0;
    const lessonWords = words.map(() => ({ id: randomUUID() }));
    const lesson: LessonRecord = {
      learnerId,
      wordListId,
      expiresAt: this.expiry(),
      state: new VocabularyLessonState(
        lessonWords,
        createVocabularyLessonRandom(randomSeed)
      ),
      canonicalWordIdByLessonWordId: new Map(
        lessonWords.map((word, index) => [word.id, words[index].id])
      ),
    };
    this.lessons.set(lessonId, lesson);

    const firstStep = lesson.state.next();
    if (firstStep.kind === "lesson-complete") {
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
    };
  }

  authorizeContent(
    learnerId: string,
    lessonId: string,
    capability: string,
    contentType: VocabularyScreenContentType,
    exampleIndex?: number
  ): AuthorizedVocabularyContent | null {
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
          wordId: this.requireCanonicalWordId(lesson, record.step.wordId),
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

    return {
      capability,
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

  recordContentResponse(
    authorization: AuthorizedVocabularyContent,
    content: VocabularyContentResponse
  ): void {
    const record = this.capabilities.get(authorization.capability);
    const lesson = this.lessons.get(
      record?.lessonId ?? ""
    );
    if (!record || !lesson || record.contentResponse) {
      return;
    }
    record.contentResponse = content;

    if (!record.attemptId) {
      return;
    }
    const attempt = this.attempts.get(record.attemptId);
    if (!attempt || attempt.activated) {
      return;
    }
    const validChoiceIds =
      content.contentType === "definition-practice"
        ? content.choices.map((choice) => choice.id)
        : [];
    lesson.state.activateAttempt({
      wordId: attempt.lessonWordId,
      answerType: attempt.answerType,
      attemptId: attempt.attemptId,
      validChoiceIds,
      review: attempt.review,
    });
    attempt.activated = true;
  }

  resolveAnswer(
    learnerId: string,
    submission: VocabularyAnswerSubmission,
    grade: (
      attempt: VocabularyAttemptAuthorization,
      submission: VocabularyAnswerSubmission
    ) => VocabularyAnswerResult | null
  ): VocabularyAnswerResult | null {
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

  getAttempt(
    learnerId: string,
    submission: VocabularyAnswerSubmission
  ): VocabularyAttemptAuthorization | null {
    this.removeExpiredRecords();
    const attempt = this.attempts.get(submission.attemptId);
    if (
      !attempt ||
      attempt.status !== "active" ||
      !attempt.activated ||
      attempt.learnerId !== learnerId ||
      attempt.answerType !== submission.answerType
    ) {
      return null;
    }
    return attempt;
  }

  getSpellingAttempt(
    learnerId: string,
    reference: string
  ): VocabularyAttemptAuthorization | null {
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
