import assert from "node:assert/strict";
import test from "node:test";
import {
  runSpeakRequest,
  createSpeakRequestBridge,
} from "../../src/lib/learning-engine/speech/runSpeakRequest";
import {
  SpeechPlaybackController,
  type SpeechPlaybackDeps,
} from "../../src/lib/learning-engine/speech/SpeechPlaybackController";
import type {
  ActionPayload,
  LearningEngineStateSetters,
  SpeechFailureNotice,
} from "../../src/types/learning";

// This Node test environment has no `window`/`Audio`, so the real singleton
// speech service (imported by runSpeakRequest, with no injectable seam)
// deterministically takes its "unsupported" failure path for every call.
// That is enough to prove the top-level wrapper (parse -> call the singleton
// with the bridge -> forward `started` to isSpeaking), but not the full
// callback-to-state mapping: a real singleton call in this environment can
// never start (`started` is always false) or succeed.
//
// `createSpeakRequestBridge` is exported from runSpeakRequest.ts for exactly
// this reason: it is the same pure onDone/onSuccess/onFailure mapping the
// production wrapper uses, and it can be driven directly against a real
// SpeechPlaybackController with fake deps (the same pattern as
// tests/tts/SpeechPlaybackController.test.ts) to prove every required branch
// -- including started -> isSpeaking true, onSuccess clearing a notice, and
// stale/canceled/replaced work never mutating the notice -- without a
// production dependency-injection framework. The real singleton wiring itself
// is covered end-to-end in tests/e2e/speechPlaybackFailure.e2e.ts.

const VALID_PAYLOAD: ActionPayload = {
  text: "hello",
  tts: { provider: "lemonfox", voice: "sarah" },
};

const VALID_TTS = { provider: "lemonfox" as const, voice: "sarah" };

function createSetters(): {
  setters: LearningEngineStateSetters;
  isSpeakingValues: boolean[];
  noticeValues: Array<SpeechFailureNotice | null>;
} {
  const isSpeakingValues: boolean[] = [];
  const noticeValues: Array<SpeechFailureNotice | null> = [];

  return {
    setters: {
      setActiveScreen: () => {},
      setShowHeader: () => {},
      setShowSidebar: () => {},
      setAnswerFeedback: () => {},
      setIsSpeaking: (isSpeaking) => isSpeakingValues.push(isSpeaking),
      setSpeechFailureNotice: (notice) => noticeValues.push(notice),
    },
    isSpeakingValues,
    noticeValues,
  };
}

async function withMutedWarn<T>(operation: () => T): Promise<T> {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    return operation();
  } finally {
    console.warn = originalWarn;
  }
}

test("an unsupported-environment failure sets isSpeaking false and stores only { requestId } in the notice", async () => {
  const { setters, isSpeakingValues, noticeValues } = createSetters();

  await withMutedWarn(() => runSpeakRequest(VALID_PAYLOAD, setters));

  assert.ok(isSpeakingValues.every((value) => value === false));
  assert.ok(isSpeakingValues.length >= 1);

  assert.equal(noticeValues.length, 1);
  const notice = noticeValues[0];
  assert.ok(notice);
  assert.deepEqual(Object.keys(notice), ["requestId"]);
  assert.equal(typeof notice.requestId, "number");
});

test("each call produces its own increasing requestId and never reuses a prior notice", async () => {
  const { setters, noticeValues } = createSetters();

  await withMutedWarn(() => runSpeakRequest(VALID_PAYLOAD, setters));
  await withMutedWarn(() => runSpeakRequest(VALID_PAYLOAD, setters));

  assert.equal(noticeValues.length, 2);
  const [first, second] = noticeValues;
  assert.ok(first && second);
  assert.notEqual(first.requestId, second.requestId);
});

test("the diagnostic reporter logs the structured event for the same failing request", async () => {
  const warnCalls: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args);
  };

  const { setters, noticeValues } = createSetters();
  try {
    runSpeakRequest(VALID_PAYLOAD, setters);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warnCalls.length, 1);
  assert.equal(warnCalls[0][0], "speech_playback_failure");
  const payload = warnCalls[0][1] as Record<string, unknown>;
  assert.equal(payload.event, "speech_playback_failure");
  assert.equal(payload.stage, "unsupported");
  assert.equal(payload.requestId, noticeValues[0]?.requestId);
  assert.equal(typeof payload.occurredAt, "string");
});

// --- Deterministic bridge coverage against a real controller with fake deps ---

async function flush(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeAudioBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/mpeg" });
}

function fakeResponse(ok: boolean, status = ok ? 200 : 500): Response {
  return { ok, status, blob: async () => fakeAudioBlob() } as unknown as Response;
}

class FakeAudioElement {
  private currentSrc = "";
  private listeners: Array<() => void> = [];

  get src(): string {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
  }

  play(): Promise<void> {
    return Promise.resolve();
  }

  pause(): void {}

  removeAttribute(name: string): void {
    if (name === "src") this.src = "";
  }

  addEventListener(_type: "ended" | "error", listener: () => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(_type: "ended" | "error", listener: () => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  emitEnded(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}

function createControllerWithFakeDeps(fetchImpl: typeof fetch): {
  controller: SpeechPlaybackController;
  audio: FakeAudioElement;
} {
  const audio = new FakeAudioElement();
  const deps: SpeechPlaybackDeps = {
    isSupported: () => true,
    fetchImpl,
    createAudioElement: () => audio as unknown as HTMLAudioElement,
    createObjectURL: () => "blob:fake",
    revokeObjectURL: () => {},
    reportFailure: () => {},
  };
  return { controller: new SpeechPlaybackController(deps), audio };
}

test("a started request sets isSpeaking true, and its later success clears an existing notice", async () => {
  const { setters, isSpeakingValues, noticeValues } = createSetters();
  const bridge = createSpeakRequestBridge(setters);
  const { controller, audio } = createControllerWithFakeDeps(
    (async () => fakeResponse(true)) as typeof fetch
  );

  const started = controller.speakText({ text: "hello", tts: VALID_TTS }, bridge);
  setters.setIsSpeaking(started);

  assert.equal(started, true);
  assert.deepEqual(isSpeakingValues, [true]);

  // Seed a prior notice, exactly as an earlier failed request would have.
  setters.setSpeechFailureNotice({ requestId: 1 });
  noticeValues.length = 0;

  await flush();
  audio.emitEnded();
  await flush();

  assert.deepEqual(isSpeakingValues, [true, false], "onDone must clear isSpeaking");
  assert.deepEqual(
    noticeValues,
    [null],
    "onSuccess must clear the existing notice and nothing else"
  );
});

test("a failed request stores only { requestId } in the notice and then clears isSpeaking", async () => {
  const { setters, isSpeakingValues, noticeValues } = createSetters();
  const bridge = createSpeakRequestBridge(setters);
  const { controller } = createControllerWithFakeDeps(
    (async () => fakeResponse(false)) as typeof fetch
  );

  const started = controller.speakText({ text: "hello", tts: VALID_TTS }, bridge);
  setters.setIsSpeaking(started);
  await flush();

  assert.deepEqual(isSpeakingValues, [true, false]);
  assert.equal(noticeValues.length, 1);
  const notice = noticeValues[0];
  assert.ok(notice);
  assert.deepEqual(
    Object.keys(notice),
    ["requestId"],
    "no stage/httpStatus/errorName/mediaErrorCode field may reach the notice"
  );
});

test("a replaced (stale) request's late failure and late success never mutate the notice or isSpeaking again", async () => {
  const { setters, isSpeakingValues, noticeValues } = createSetters();
  const deferredFetches: Deferred<Response>[] = [];
  const fetchImpl = (async () => {
    const deferred = createDeferred<Response>();
    deferredFetches.push(deferred);
    return deferred.promise;
  }) as typeof fetch;
  const { controller, audio } = createControllerWithFakeDeps(fetchImpl);

  // First (soon-to-be-stale) request.
  const firstBridge = createSpeakRequestBridge(setters);
  const firstStarted = controller.speakText(
    { text: "first", tts: VALID_TTS },
    firstBridge
  );
  setters.setIsSpeaking(firstStarted);
  await flush();

  // Replacement request (this internally cancels/replaces the first).
  const secondBridge = createSpeakRequestBridge(setters);
  const secondStarted = controller.speakText(
    { text: "second", tts: VALID_TTS },
    secondBridge
  );
  setters.setIsSpeaking(secondStarted);
  await flush();

  isSpeakingValues.length = 0;
  noticeValues.length = 0;

  // The stale first request now settles late, as a failure.
  deferredFetches[0].resolve(fakeResponse(false));
  await flush();

  assert.deepEqual(
    isSpeakingValues,
    [],
    "a stale request's late settlement must never call setIsSpeaking again"
  );
  assert.deepEqual(
    noticeValues,
    [],
    "a stale request's late failure must never set or clear the notice"
  );

  // The still-active second request completes successfully.
  deferredFetches[1].resolve(fakeResponse(true));
  await flush();
  audio.emitEnded();
  await flush();

  assert.deepEqual(isSpeakingValues, [false]);
  assert.deepEqual(noticeValues, [null]);
});

test("canceling an in-flight request never sets isSpeaking or a notice for that canceled generation", async () => {
  const { setters, isSpeakingValues, noticeValues } = createSetters();
  const deferredFetches: Deferred<Response>[] = [];
  const fetchImpl = (async () => {
    const deferred = createDeferred<Response>();
    deferredFetches.push(deferred);
    return deferred.promise;
  }) as typeof fetch;
  const { controller } = createControllerWithFakeDeps(fetchImpl);

  const bridge = createSpeakRequestBridge(setters);
  const started = controller.speakText({ text: "hello", tts: VALID_TTS }, bridge);
  setters.setIsSpeaking(started);
  await flush();

  isSpeakingValues.length = 0;
  noticeValues.length = 0;

  controller.cancelSpeech();
  deferredFetches[0].resolve(fakeResponse(true));
  await flush();

  assert.deepEqual(
    isSpeakingValues,
    [],
    "cancellation must never call setIsSpeaking again for the canceled generation"
  );
  assert.deepEqual(
    noticeValues,
    [],
    "cancellation must never set or clear a notice for the canceled generation"
  );
});
