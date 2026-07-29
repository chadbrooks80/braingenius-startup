import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SpeechPlaybackController,
  type SpeechPlaybackDeps,
} from "../../src/lib/learning-engine/speech/SpeechPlaybackController";
import type { SpeechPlaybackFailure } from "../../src/lib/learning-engine/speech/speechPlaybackFailure";

const VALID_TTS = { provider: "lemonfox" as const, voice: "sarah" };

// Flushes pending microtasks generously so tests never depend on guessing
// exactly how many promise hops a given code path takes.
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

// A real AbortController that records every abort() call against its own
// instance. This is the only way to prove, from outside the controller's
// private fields, whether a given fetch's AbortController was ever aborted
// (and by extension, whether it was released/cleared rather than retained
// for a later, unrelated cancelSpeech() to find and abort).
class SpyAbortController extends AbortController {
  static instances: SpyAbortController[] = [];
  abortCallCount = 0;

  constructor() {
    super();
    SpyAbortController.instances.push(this);
  }

  override abort(reason?: unknown): void {
    this.abortCallCount += 1;
    super.abort(reason);
  }
}

type GlobalWithAbortController = typeof globalThis & {
  AbortController: typeof AbortController;
};

async function withSpyAbortController<T>(
  operation: () => Promise<T>
): Promise<T> {
  const globalWithAbort = globalThis as GlobalWithAbortController;
  const OriginalAbortController = globalWithAbort.AbortController;
  SpyAbortController.instances = [];
  globalWithAbort.AbortController = SpyAbortController;
  try {
    return await operation();
  } finally {
    globalWithAbort.AbortController = OriginalAbortController;
  }
}

// A non-empty fake audio blob; the controller now treats an empty blob as an
// audio-blob failure, so every successful-path fixture must be non-empty.
function fakeAudioBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/mpeg" });
}

// A minimal fake Response: only .ok, .status, and .blob() are ever read by
// the controller, so a real Node Response (with its own internal stream
// timing) is unnecessary and makes test timing nondeterministic.
function fakeResponse(
  ok: boolean,
  blob: Blob = fakeAudioBlob(),
  status = ok ? 200 : 500
): Response {
  return { ok, status, blob: async () => blob } as unknown as Response;
}

type FakeMediaError = { code: number };

class FakeAudioElement {
  private currentSrc = "";
  playCount = 0;
  playRejects = false;
  playThrowsSynchronously = false;
  srcAssignmentThrows = false;
  error: FakeMediaError | null = null;
  private listeners: Record<"ended" | "error", Array<() => void>> = {
    ended: [],
    error: [],
  };

  get src(): string {
    return this.currentSrc;
  }

  set src(value: string) {
    if (this.srcAssignmentThrows && value.startsWith("blob:")) {
      throw new DOMException("source assignment failed", "NotSupportedError");
    }
    this.currentSrc = value;
  }

  play(): Promise<void> {
    this.playCount += 1;
    if (this.playThrowsSynchronously) {
      throw new DOMException("play() failed synchronously", "NotSupportedError");
    }
    if (this.playRejects) {
      return Promise.reject(new DOMException("autoplay blocked", "NotAllowedError"));
    }
    return Promise.resolve();
  }

  pause(): void {}

  removeAttribute(name: string): void {
    if (name === "src") this.src = "";
  }

  addEventListener(type: "ended" | "error", listener: () => void): void {
    this.listeners[type].push(listener);
  }

  removeEventListener(type: "ended" | "error", listener: () => void): void {
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  emit(type: "ended" | "error"): void {
    for (const listener of [...this.listeners[type]]) {
      listener();
    }
  }
}

function createFakeDeps(overrides?: {
  audio?: FakeAudioElement;
  fetchImpl?: typeof fetch;
  isSupported?: () => boolean;
}) {
  const audio = overrides?.audio ?? new FakeAudioElement();
  const createObjectURLCalls: Blob[] = [];
  const revokeObjectURLCalls: string[] = [];
  const reportedFailures: SpeechPlaybackFailure[] = [];
  let objectUrlCounter = 0;

  const deps: SpeechPlaybackDeps = {
    isSupported: overrides?.isSupported ?? (() => true),
    fetchImpl:
      overrides?.fetchImpl ??
      ((async () => fakeResponse(true)) as typeof fetch),
    createAudioElement: () => audio as unknown as HTMLAudioElement,
    createObjectURL: (blob: Blob) => {
      createObjectURLCalls.push(blob);
      objectUrlCounter += 1;
      return `blob:fake-${objectUrlCounter}`;
    },
    revokeObjectURL: (url: string) => {
      revokeObjectURLCalls.push(url);
    },
    reportFailure: (failure) => {
      reportedFailures.push(failure);
    },
  };

  return {
    deps,
    audio,
    createObjectURLCalls,
    revokeObjectURLCalls,
    reportedFailures,
  };
}

type Settlement = {
  doneCalls: number;
  successCalls: number;
  failures: SpeechPlaybackFailure[];
};

function trackSettlement(): {
  settlement: Settlement;
  options: {
    onDone: () => void;
    onSuccess: () => void;
    onFailure: (failure: SpeechPlaybackFailure) => void;
  };
} {
  const settlement: Settlement = { doneCalls: 0, successCalls: 0, failures: [] };
  return {
    settlement,
    options: {
      onDone: () => {
        settlement.doneCalls += 1;
      },
      onSuccess: () => {
        settlement.successCalls += 1;
      },
      onFailure: (failure) => {
        settlement.failures.push(failure);
      },
    },
  };
}

test("speakText returns false when unsupported, never fetches, and reports an unsupported failure once", async () => {
  let fetchCalls = 0;
  const { deps, reportedFailures } = createFakeDeps({
    isSupported: () => false,
    fetchImpl: (async () => {
      fetchCalls += 1;
      return fakeResponse(true);
    }) as typeof fetch,
  });

  const controller = new SpeechPlaybackController(deps);
  const { settlement, options } = trackSettlement();
  const started = controller.speakText({ text: "hello", tts: VALID_TTS }, options);

  assert.equal(started, false);
  assert.equal(fetchCalls, 0);
  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.successCalls, 0);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "unsupported");
  assert.deepEqual(reportedFailures, settlement.failures);
});

test("speakText returns false for an all-blank queue, reports no failure, and never disturbs prior speech", async () => {
  let fetchCalls = 0;
  const { deps, audio } = createFakeDeps({
    fetchImpl: (async () => {
      fetchCalls += 1;
      return fakeResponse(true);
    }) as typeof fetch,
  });

  const controller = new SpeechPlaybackController(deps);

  const first = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, first.options);
  await flush();
  assert.equal(audio.src, "blob:fake-1");

  const second = trackSettlement();
  const started = controller.speakText({ text: ["", "   "], tts: VALID_TTS }, second.options);

  assert.equal(started, false);
  assert.equal(fetchCalls, 1, "the blank request must never fetch");
  assert.equal(second.settlement.doneCalls, 0);
  assert.equal(second.settlement.failures.length, 0);

  // The earlier active speech is undisturbed by the blank no-op call.
  audio.emit("ended");
  await flush();
  assert.equal(first.settlement.doneCalls, 1);
  assert.equal(first.settlement.successCalls, 1);
});

test("speakText plays a single string entry and calls onSuccess then onDone once", async () => {
  const { deps, audio } = createFakeDeps();
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  const started = controller.speakText({ text: "hello", tts: VALID_TTS }, options);

  assert.equal(started, true);

  await flush();
  assert.equal(audio.src, "blob:fake-1");

  audio.emit("ended");
  await flush();

  assert.equal(settlement.successCalls, 1);
  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.failures.length, 0);
});

test("queue entries synthesize and play sequentially, not in parallel", async () => {
  const fetchCallOrder: string[] = [];
  const deferredFetches: Deferred<Response>[] = [];

  const fetchImpl = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { text: string };
    fetchCallOrder.push(body.text);
    const deferred = createDeferred<Response>();
    deferredFetches.push(deferred);
    return deferred.promise;
  }) as typeof fetch;

  const { deps, audio } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: ["first", "second"], tts: VALID_TTS }, options);

  await flush();
  assert.deepEqual(fetchCallOrder, ["first"], "second entry must not fetch yet");

  deferredFetches[0].resolve(fakeResponse(true));
  await flush();

  audio.emit("ended");
  await flush();

  assert.deepEqual(fetchCallOrder, ["first", "second"]);
  assert.equal(settlement.doneCalls, 0, "onDone must not fire until the final entry ends");

  deferredFetches[1].resolve(fakeResponse(true));
  await flush();

  audio.emit("ended");
  await flush();

  assert.equal(settlement.successCalls, 1);
  assert.equal(settlement.doneCalls, 1);
});

test("a new speakText call cancels and replaces the previous request", async () => {
  const deferredFetches: Deferred<Response>[] = [];
  const fetchImpl = (async () => {
    const deferred = createDeferred<Response>();
    deferredFetches.push(deferred);
    return deferred.promise;
  }) as typeof fetch;

  const { deps, audio } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const first = trackSettlement();
  const second = trackSettlement();

  controller.speakText({ text: "first", tts: VALID_TTS }, first.options);
  await flush();

  controller.speakText({ text: "second", tts: VALID_TTS }, second.options);
  await flush();

  // Resolve the first (aborted, stale) fetch late; it must not affect state.
  deferredFetches[0].resolve(fakeResponse(true));
  await flush();

  assert.equal(first.settlement.doneCalls, 0);
  assert.equal(first.settlement.failures.length, 0, "a stale/replaced request must never report a failure");

  deferredFetches[1].resolve(fakeResponse(true));
  await flush();

  audio.emit("ended");
  await flush();

  assert.equal(first.settlement.doneCalls, 0, "stale generation must never settle");
  assert.equal(second.settlement.successCalls, 1);
  assert.equal(second.settlement.doneCalls, 1);
});

test("cancelSpeech mid-playback revokes the object URL and never calls onDone or reports a failure", async () => {
  const { deps, audio, revokeObjectURLCalls } = createFakeDeps();
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);

  await flush();
  assert.equal(audio.src, "blob:fake-1");

  controller.cancelSpeech();

  assert.equal(settlement.doneCalls, 0);
  assert.equal(settlement.failures.length, 0);
  assert.deepEqual(revokeObjectURLCalls, ["blob:fake-1"]);

  // A late "ended" firing on the (now-detached) audio element must be inert.
  audio.emit("ended");
  await flush();
  assert.equal(settlement.doneCalls, 0);
});

test("cancelSpeech is safe before any playback and when called repeatedly", () => {
  const { deps } = createFakeDeps();
  const controller = new SpeechPlaybackController(deps);

  assert.doesNotThrow(() => {
    controller.cancelSpeech();
    controller.cancelSpeech();
  });
});

test("an active fetch rejection reports a request failure exactly once", async () => {
  const fetchImpl = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  const { deps, reportedFailures } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);

  await flush();

  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.successCalls, 0);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "request");
  assert.deepEqual(reportedFailures, settlement.failures);
});

test("an aborted/replaced fetch rejection reports nothing", async () => {
  const deferredFetches: Deferred<Response>[] = [];
  const fetchImpl = (async () => {
    const deferred = createDeferred<Response>();
    deferredFetches.push(deferred);
    return deferred.promise;
  }) as typeof fetch;

  const { deps } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const first = trackSettlement();
  controller.speakText({ text: "first", tts: VALID_TTS }, first.options);
  await flush();

  controller.cancelSpeech();
  deferredFetches[0].reject(new DOMException("aborted", "AbortError"));
  await flush();

  assert.equal(first.settlement.failures.length, 0);
  assert.equal(first.settlement.doneCalls, 0);
});

test("each representative non-OK response reports http-response with only its integer status", async () => {
  for (const status of [401, 429, 500, 503]) {
    const fetchImpl = (async () => fakeResponse(false, undefined, status)) as typeof fetch;
    const { deps } = createFakeDeps({ fetchImpl });
    const controller = new SpeechPlaybackController(deps);

    const { settlement, options } = trackSettlement();
    controller.speakText({ text: "hello", tts: VALID_TTS }, options);
    await flush();

    assert.equal(settlement.doneCalls, 1);
    assert.equal(settlement.failures.length, 1);
    assert.equal(settlement.failures[0].stage, "http-response");
    assert.equal(settlement.failures[0].httpStatus, status);
    assert.equal(settlement.failures[0].errorName, undefined);
  }
});

test("response.blob() rejection reports an audio-blob failure", async () => {
  const fetchImpl = (async () => ({
    ok: true,
    status: 200,
    blob: async () => {
      throw new Error("stream error");
    },
  })) as unknown as typeof fetch;

  const { deps } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);
  await flush();

  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "audio-blob");
});

test("an empty response blob reports an audio-blob failure", async () => {
  const fetchImpl = (async () => fakeResponse(true, new Blob())) as typeof fetch;
  const { deps } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);
  await flush();

  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "audio-blob");
});

test("an explicitly non-audio response blob reports an audio-blob failure", async () => {
  const responseBlob = new Blob(["provider error"], { type: "text/plain" });
  const fetchImpl = (async () => fakeResponse(true, responseBlob)) as typeof fetch;
  const { deps, createObjectURLCalls } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);
  await flush();

  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "audio-blob");
  assert.equal(createObjectURLCalls.length, 0);
});

test("an audio element error event reports audio-decode with the media error code and revokes the object URL", async () => {
  const audio = new FakeAudioElement();
  const { deps, revokeObjectURLCalls } = createFakeDeps({ audio });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);

  await flush();

  audio.error = { code: 3 };
  audio.emit("error");
  await flush();

  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "audio-decode");
  assert.equal(settlement.failures[0].mediaErrorCode, 3);
  assert.deepEqual(revokeObjectURLCalls, ["blob:fake-1"]);

  // A late "ended" after the error must not settle a second time.
  audio.emit("ended");
  await flush();
  assert.equal(settlement.doneCalls, 1);
});

test("a synchronous real-audio play() throw reports an audio-play failure", async () => {
  const audio = new FakeAudioElement();
  audio.playThrowsSynchronously = true;
  const { deps } = createFakeDeps({ audio });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);

  await flush();

  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "audio-play");
});

test("a rejected real-audio play() promise reports an audio-play failure with a safe error name", async () => {
  const audio = new FakeAudioElement();
  audio.playRejects = true;
  const { deps } = createFakeDeps({ audio });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);

  await flush();

  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "audio-play");
  assert.equal(settlement.failures[0].errorName, "NotAllowedError");
});

test("a synchronous audio source assignment failure reports once and revokes its object URL", async () => {
  const audio = new FakeAudioElement();
  audio.srcAssignmentThrows = true;
  const { deps, revokeObjectURLCalls } = createFakeDeps({ audio });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);
  await flush();

  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.successCalls, 0);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "audio-blob");
  assert.equal(settlement.failures[0].errorName, "NotSupportedError");
  assert.deepEqual(revokeObjectURLCalls, ["blob:fake-1"]);
});

test("every active failure calls the reporter, onFailure, and onDone exactly once and never onSuccess", async () => {
  const fetchImpl = (async () => fakeResponse(false)) as typeof fetch;
  const { deps, reportedFailures } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);
  await flush();

  assert.equal(reportedFailures.length, 1);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.successCalls, 0);
});

test("a later-chunk failure stops the remaining queue and reports once", async () => {
  const fetchedTexts: string[] = [];
  const fetchImpl = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { text: string };
    fetchedTexts.push(body.text);
    if (body.text === "second") {
      return fakeResponse(false);
    }
    return fakeResponse(true);
  }) as typeof fetch;

  const { deps, audio } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: ["first", "second", "third"], tts: VALID_TTS }, options);

  await flush();
  audio.emit("ended");
  await flush();

  assert.deepEqual(fetchedTexts, ["first", "second"], "the third chunk must never be fetched");
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "http-response");
  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.successCalls, 0);
});

test("canceling during fetch calls no settlement callback for the canceled generation", async () => {
  const deferredFetches: Deferred<Response>[] = [];
  const fetchImpl = (async () => {
    const deferred = createDeferred<Response>();
    deferredFetches.push(deferred);
    return deferred.promise;
  }) as typeof fetch;

  const { deps } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);
  await flush();

  controller.cancelSpeech();
  deferredFetches[0].resolve(fakeResponse(true));
  await flush();

  assert.equal(settlement.doneCalls, 0);
  assert.equal(settlement.successCalls, 0);
  assert.equal(settlement.failures.length, 0);
});

test("a rejected fetch after cancellation must not report a failure even though the caught error is a plain error", async () => {
  const deferredFetches: Deferred<Response>[] = [];
  const fetchImpl = (async () => {
    const deferred = createDeferred<Response>();
    deferredFetches.push(deferred);
    return deferred.promise;
  }) as typeof fetch;

  const { deps, reportedFailures } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, options);
  await flush();

  controller.cancelSpeech();
  deferredFetches[0].reject(new Error("connection reset"));
  await flush();

  assert.equal(reportedFailures.length, 0);
  assert.equal(settlement.failures.length, 0);
});

test("a server-resolved source posts only the opaque reference and plays the returned audio", async () => {
  const fetchCalls: Array<{ url: string; body: string }> = [];
  const fetchImpl = (async (input, init) => {
    fetchCalls.push({ url: String(input), body: String(init?.body) });
    return fakeResponse(true);
  }) as typeof fetch;

  const { deps, audio } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  const started = controller.speakText(
    {
      source: {
        endpoint: "/api/learning/vocabulary/speech",
        reference: "opaque-ref-1",
      },
    },
    options
  );

  assert.equal(started, true);
  await flush();

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "/api/learning/vocabulary/speech");
  assert.deepEqual(JSON.parse(fetchCalls[0].body), {
    reference: "opaque-ref-1",
  });
  assert.equal(audio.src, "blob:fake-1");

  audio.emit("ended");
  await flush();
  assert.equal(settlement.successCalls, 1);
  assert.equal(settlement.doneCalls, 1);
});

test("a failed server-resolved source request reports http-response once", async () => {
  const fetchImpl = (async () => fakeResponse(false)) as typeof fetch;
  const { deps } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText(
    { source: { endpoint: "/speech", reference: "opaque-ref-2" } },
    options
  );

  await flush();
  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "http-response");
});

test("a long public passage is split into ordered provider-safe chunks fetched and played sequentially", async () => {
  const sentences = Array.from(
    { length: 40 },
    (_, index) => `Sentence number ${index} has ${"filler ".repeat(30)}words.`
  );
  const longPassage = sentences.join(" ");
  const encoder = new TextEncoder();
  assert.ok(encoder.encode(longPassage).length > 5000);

  const fetchedTexts: string[] = [];
  const fetchImpl = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { text: string };
    fetchedTexts.push(body.text);
    return fakeResponse(true);
  }) as typeof fetch;

  const { deps, audio } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  const started = controller.speakText({ text: longPassage, tts: VALID_TTS }, options);
  assert.equal(started, true);

  // Drive the queue to completion one chunk at a time.
  let playedChunks = 0;
  for (let guard = 0; guard < 20; guard += 1) {
    await flush();
    if (settlement.doneCalls > 0) {
      break;
    }
    playedChunks += 1;
    audio.emit("ended");
  }
  await flush();

  assert.equal(settlement.successCalls, 1);
  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.failures.length, 0);
  assert.ok(fetchedTexts.length > 1, "a long passage produces multiple chunks");
  assert.equal(playedChunks, fetchedTexts.length, "chunks play strictly sequentially");
  for (const chunk of fetchedTexts) {
    assert.ok(
      encoder.encode(chunk).length <= 5000,
      "no fetched chunk exceeds the provider boundary"
    );
  }
  // Order and words are preserved exactly across the chunk boundary.
  assert.deepEqual(
    fetchedTexts.flatMap((chunk) => chunk.split(/\s+/)),
    longPassage.split(/\s+/)
  );
});

test("cancellation between chunks stops the remaining chunk fetches of a long passage", async () => {
  const longPassage = Array.from(
    { length: 40 },
    (_, index) => `Sentence number ${index} has ${"filler ".repeat(30)}words.`
  ).join(" ");

  const fetchedTexts: string[] = [];
  const fetchImpl = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { text: string };
    fetchedTexts.push(body.text);
    return fakeResponse(true);
  }) as typeof fetch;

  const { deps, audio } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const { settlement, options } = trackSettlement();
  controller.speakText({ text: longPassage, tts: VALID_TTS }, options);
  await flush();
  assert.equal(fetchedTexts.length, 1, "only the first chunk is in flight");

  controller.cancelSpeech();
  audio.emit("ended");
  await flush();

  assert.equal(fetchedTexts.length, 1, "no further chunk is fetched after cancellation");
  assert.equal(settlement.doneCalls, 0);
  assert.equal(settlement.failures.length, 0);
});

test("a passage containing an unsplittable oversized token fails safely, reports request-preparation, and never fetches", async () => {
  let fetchCalls = 0;
  const { deps, reportedFailures } = createFakeDeps({
    fetchImpl: (async () => {
      fetchCalls += 1;
      return fakeResponse(true);
    }) as typeof fetch,
  });

  const controller = new SpeechPlaybackController(deps);
  const { settlement, options } = trackSettlement();
  const started = controller.speakText(
    { text: `normal words then ${"x".repeat(6000)}`, tts: VALID_TTS },
    options
  );

  assert.equal(started, false);
  assert.equal(fetchCalls, 0);
  assert.equal(settlement.doneCalls, 1);
  assert.equal(settlement.failures.length, 1);
  assert.equal(settlement.failures[0].stage, "request-preparation");
  assert.deepEqual(reportedFailures, settlement.failures);
});

test("primeSpeechPlayback is idempotent and swallows a rejected play() without reporting a failure", async () => {
  const audio = new FakeAudioElement();
  audio.playRejects = true;
  const { deps, reportedFailures } = createFakeDeps({ audio });
  const controller = new SpeechPlaybackController(deps);

  assert.doesNotThrow(() => {
    controller.primeSpeechPlayback();
    controller.primeSpeechPlayback();
  });
  assert.equal(audio.playCount, 2);
  await flush();
  assert.equal(reportedFailures.length, 0);
});

test("a successful retry after a failure clears via onSuccess and uses a fresh requestId", async () => {
  let attempt = 0;
  const fetchImpl = (async () => {
    attempt += 1;
    return attempt === 1 ? fakeResponse(false) : fakeResponse(true);
  }) as typeof fetch;

  const { deps, audio } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  const first = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, first.options);
  await flush();
  assert.equal(first.settlement.failures.length, 1);
  const failedRequestId = first.settlement.failures[0].requestId;

  const retry = trackSettlement();
  controller.speakText({ text: "hello", tts: VALID_TTS }, retry.options);
  await flush();
  audio.emit("ended");
  await flush();

  assert.equal(retry.settlement.successCalls, 1);
  assert.equal(retry.settlement.failures.length, 0);
  assert.notEqual(retry.settlement.doneCalls, 0);
  assert.ok(
    typeof failedRequestId === "number",
    "the failed attempt must carry a numeric requestId"
  );
});

test("a successfully completed request releases its controller so a later cancel does not abort it", () =>
  withSpyAbortController(async () => {
    const { deps, audio } = createFakeDeps();
    const controller = new SpeechPlaybackController(deps);

    const { options } = trackSettlement();
    controller.speakText({ text: "hello", tts: VALID_TTS }, options);
    await flush();

    audio.emit("ended");
    await flush();

    assert.equal(SpyAbortController.instances.length, 1);
    const [settledController] = SpyAbortController.instances;
    assert.equal(settledController.abortCallCount, 0);

    // If the completed controller were still retained, this would abort it.
    controller.cancelSpeech();
    assert.equal(
      settledController.abortCallCount,
      0,
      "a later cancel must not abort an already-settled, released controller"
    );
  }));

test("request, http-response, and audio-blob failure paths release their completed controller", async () => {
  const scenarios: Array<{
    name: string;
    fetchImpl: typeof fetch;
  }> = [
    {
      name: "request rejection",
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as typeof fetch,
    },
    {
      name: "non-OK http response",
      fetchImpl: (async () => fakeResponse(false)) as typeof fetch,
    },
    {
      name: "audio-blob rejection",
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        blob: async () => {
          throw new Error("stream error");
        },
      })) as unknown as typeof fetch,
    },
  ];

  for (const scenario of scenarios) {
    await withSpyAbortController(async () => {
      const { deps } = createFakeDeps({ fetchImpl: scenario.fetchImpl });
      const controller = new SpeechPlaybackController(deps);

      const { settlement, options } = trackSettlement();
      controller.speakText({ text: "hello", tts: VALID_TTS }, options);
      await flush();

      assert.equal(settlement.failures.length, 1, scenario.name);
      assert.equal(SpyAbortController.instances.length, 1, scenario.name);
      const [settledController] = SpyAbortController.instances;
      assert.equal(settledController.abortCallCount, 0, scenario.name);

      // If the failed request's controller were still retained, this would
      // abort it even though the request already settled.
      controller.cancelSpeech();
      assert.equal(
        settledController.abortCallCount,
        0,
        `${scenario.name}: a later cancel must not abort an already-settled, released controller`
      );
    });
  }
});

test("cancelSpeech aborts an actually pending fetch's controller", () =>
  withSpyAbortController(async () => {
    const deferredFetches: Deferred<Response>[] = [];
    const fetchImpl = (async () => {
      const deferred = createDeferred<Response>();
      deferredFetches.push(deferred);
      return deferred.promise;
    }) as typeof fetch;

    const { deps } = createFakeDeps({ fetchImpl });
    const controller = new SpeechPlaybackController(deps);

    const { options } = trackSettlement();
    controller.speakText({ text: "hello", tts: VALID_TTS }, options);
    await flush();

    assert.equal(SpyAbortController.instances.length, 1);
    const [pendingController] = SpyAbortController.instances;
    assert.equal(pendingController.abortCallCount, 0);

    controller.cancelSpeech();
    assert.equal(
      pendingController.abortCallCount,
      1,
      "an actually in-flight request must still be aborted on cancel"
    );
  }));

test("a stale completed fetch cannot clear or abort the current active generation's controller", () =>
  withSpyAbortController(async () => {
    const deferredFetches: Deferred<Response>[] = [];
    const fetchImpl = (async () => {
      const deferred = createDeferred<Response>();
      deferredFetches.push(deferred);
      return deferred.promise;
    }) as typeof fetch;

    const { deps } = createFakeDeps({ fetchImpl });
    const controller = new SpeechPlaybackController(deps);

    const first = trackSettlement();
    controller.speakText({ text: "first", tts: VALID_TTS }, first.options);
    await flush();

    const second = trackSettlement();
    controller.speakText({ text: "second", tts: VALID_TTS }, second.options);
    await flush();

    assert.equal(SpyAbortController.instances.length, 2);
    const [controllerA, controllerB] = SpyAbortController.instances;
    // Replacing A synchronously cancels and aborts A's own controller.
    assert.equal(controllerA.abortCallCount, 1);
    assert.equal(controllerB.abortCallCount, 0);

    // A's late (stale) resolution settles after B has already started; it
    // must not touch B's still-active controller.
    deferredFetches[0].resolve(fakeResponse(true));
    await flush();
    assert.equal(controllerB.abortCallCount, 0);
    assert.equal(first.settlement.doneCalls, 0);
    assert.equal(first.settlement.failures.length, 0);

    // B must still be genuinely cancelable: if A's stale cleanup had
    // incorrectly cleared the active controller field, this would silently
    // do nothing and B's controller would never actually be aborted.
    controller.cancelSpeech();
    assert.equal(
      controllerB.abortCallCount,
      1,
      "B's controller must still be reachable and abortable after A's stale settlement"
    );

    deferredFetches[1].reject(new DOMException("aborted", "AbortError"));
    await flush();
    assert.equal(second.settlement.doneCalls, 0);
    assert.equal(second.settlement.failures.length, 0);
  }));

test("multi-chunk cleanup of a completed earlier fetch cannot clear or abort the active later fetch's controller", () =>
  withSpyAbortController(async () => {
    const deferredFetches: Deferred<Response>[] = [];
    const fetchImpl = (async () => {
      const deferred = createDeferred<Response>();
      deferredFetches.push(deferred);
      return deferred.promise;
    }) as typeof fetch;

    const { deps, audio } = createFakeDeps({ fetchImpl });
    const controller = new SpeechPlaybackController(deps);

    const { settlement, options } = trackSettlement();
    controller.speakText({ text: ["first", "second"], tts: VALID_TTS }, options);

    await flush();
    assert.equal(SpyAbortController.instances.length, 1);
    const [firstChunkController] = SpyAbortController.instances;

    deferredFetches[0].resolve(fakeResponse(true));
    await flush();
    audio.emit("ended");
    await flush();

    assert.equal(SpyAbortController.instances.length, 2);
    const [, secondChunkController] = SpyAbortController.instances;
    assert.equal(
      firstChunkController.abortCallCount,
      0,
      "the completed first chunk's controller must never be aborted"
    );

    controller.cancelSpeech();
    assert.equal(
      secondChunkController.abortCallCount,
      1,
      "canceling during the second chunk must abort its own active controller"
    );
    assert.equal(
      firstChunkController.abortCallCount,
      0,
      "canceling the active later chunk must not retroactively abort the earlier completed controller"
    );
    assert.equal(settlement.doneCalls, 0);
  }));
