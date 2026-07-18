import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SpeechPlaybackController,
  type SpeechPlaybackDeps,
} from "../../src/lib/learning-engine/speech/SpeechPlaybackController";

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

// A minimal fake Response: only .ok and .blob() are ever read by the
// controller, so a real Node Response (with its own internal stream timing)
// is unnecessary and makes test timing nondeterministic.
function fakeResponse(ok: boolean, blob: Blob = new Blob()): Response {
  return { ok, blob: async () => blob } as unknown as Response;
}

class FakeAudioElement {
  src = "";
  playCount = 0;
  playRejects = false;
  private listeners: Record<"ended" | "error", Array<() => void>> = {
    ended: [],
    error: [],
  };

  play(): Promise<void> {
    this.playCount += 1;
    if (this.playRejects) {
      return Promise.reject(new Error("autoplay blocked"));
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
}) {
  const audio = overrides?.audio ?? new FakeAudioElement();
  const createObjectURLCalls: Blob[] = [];
  const revokeObjectURLCalls: string[] = [];
  let objectUrlCounter = 0;

  const deps: SpeechPlaybackDeps = {
    isSupported: () => true,
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
  };

  return { deps, audio, createObjectURLCalls, revokeObjectURLCalls };
}

test("speakText returns false when unsupported and never fetches", () => {
  let fetchCalls = 0;
  const { deps } = createFakeDeps({
    fetchImpl: (async () => {
      fetchCalls += 1;
      return fakeResponse(true);
    }) as typeof fetch,
  });
  deps.isSupported = () => false;

  const controller = new SpeechPlaybackController(deps);
  const started = controller.speakText({ text: "hello", tts: VALID_TTS });

  assert.equal(started, false);
  assert.equal(fetchCalls, 0);
});

test("speakText returns false for an all-blank queue and never fetches", () => {
  let fetchCalls = 0;
  const { deps } = createFakeDeps({
    fetchImpl: (async () => {
      fetchCalls += 1;
      return fakeResponse(true);
    }) as typeof fetch,
  });

  const controller = new SpeechPlaybackController(deps);
  const started = controller.speakText({ text: ["", "   "], tts: VALID_TTS });

  assert.equal(started, false);
  assert.equal(fetchCalls, 0);
});

test("speakText plays a single string entry and calls onDone once on success", async () => {
  const { deps, audio } = createFakeDeps();
  const controller = new SpeechPlaybackController(deps);

  let doneCalls = 0;
  const started = controller.speakText(
    { text: "hello", tts: VALID_TTS },
    { onDone: () => (doneCalls += 1) }
  );

  assert.equal(started, true);

  await flush();
  assert.equal(audio.src, "blob:fake-1");

  audio.emit("ended");
  await flush();

  assert.equal(doneCalls, 1);
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

  let doneCalls = 0;
  controller.speakText(
    { text: ["first", "second"], tts: VALID_TTS },
    { onDone: () => (doneCalls += 1) }
  );

  await flush();
  assert.deepEqual(fetchCallOrder, ["first"], "second entry must not fetch yet");

  deferredFetches[0].resolve(fakeResponse(true));
  await flush();

  audio.emit("ended");
  await flush();

  assert.deepEqual(fetchCallOrder, ["first", "second"]);
  assert.equal(doneCalls, 0, "onDone must not fire until the final entry ends");

  deferredFetches[1].resolve(fakeResponse(true));
  await flush();

  audio.emit("ended");
  await flush();

  assert.equal(doneCalls, 1);
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

  let firstDoneCalls = 0;
  let secondDoneCalls = 0;

  controller.speakText(
    { text: "first", tts: VALID_TTS },
    { onDone: () => (firstDoneCalls += 1) }
  );
  await flush();

  controller.speakText(
    { text: "second", tts: VALID_TTS },
    { onDone: () => (secondDoneCalls += 1) }
  );
  await flush();

  // Resolve the first (aborted, stale) fetch late; it must not affect state.
  deferredFetches[0].resolve(fakeResponse(true));
  await flush();

  assert.equal(firstDoneCalls, 0);

  deferredFetches[1].resolve(fakeResponse(true));
  await flush();

  audio.emit("ended");
  await flush();

  assert.equal(firstDoneCalls, 0, "stale generation must never call its onDone");
  assert.equal(secondDoneCalls, 1);
});

test("cancelSpeech mid-playback revokes the object URL and never calls onDone", async () => {
  const { deps, audio, revokeObjectURLCalls } = createFakeDeps();
  const controller = new SpeechPlaybackController(deps);

  let doneCalls = 0;
  controller.speakText(
    { text: "hello", tts: VALID_TTS },
    { onDone: () => (doneCalls += 1) }
  );

  await flush();
  assert.equal(audio.src, "blob:fake-1");

  controller.cancelSpeech();

  assert.equal(doneCalls, 0);
  assert.deepEqual(revokeObjectURLCalls, ["blob:fake-1"]);

  // A late "ended" firing on the (now-detached) audio element must be inert.
  audio.emit("ended");
  await flush();
  assert.equal(doneCalls, 0);
});

test("cancelSpeech is safe before any playback and when called repeatedly", () => {
  const { deps } = createFakeDeps();
  const controller = new SpeechPlaybackController(deps);

  assert.doesNotThrow(() => {
    controller.cancelSpeech();
    controller.cancelSpeech();
  });
});

test("a rejected fetch calls onDone exactly once", async () => {
  const fetchImpl = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  const { deps } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  let doneCalls = 0;
  controller.speakText(
    { text: "hello", tts: VALID_TTS },
    { onDone: () => (doneCalls += 1) }
  );

  await flush();

  assert.equal(doneCalls, 1);
});

test("a non-ok response calls onDone exactly once", async () => {
  const fetchImpl = (async () => fakeResponse(false)) as typeof fetch;

  const { deps } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  let doneCalls = 0;
  controller.speakText(
    { text: "hello", tts: VALID_TTS },
    { onDone: () => (doneCalls += 1) }
  );

  await flush();

  assert.equal(doneCalls, 1);
});

test("an audio error event calls onDone exactly once and revokes the object URL", async () => {
  const { deps, audio, revokeObjectURLCalls } = createFakeDeps();
  const controller = new SpeechPlaybackController(deps);

  let doneCalls = 0;
  controller.speakText(
    { text: "hello", tts: VALID_TTS },
    { onDone: () => (doneCalls += 1) }
  );

  await flush();

  audio.emit("error");
  await flush();

  assert.equal(doneCalls, 1);
  assert.deepEqual(revokeObjectURLCalls, ["blob:fake-1"]);

  // A late "ended" after the error must not call onDone a second time.
  audio.emit("ended");
  await flush();
  assert.equal(doneCalls, 1);
});

test("a rejected autoplay call counts as a failure and calls onDone exactly once", async () => {
  const audio = new FakeAudioElement();
  audio.playRejects = true;
  const { deps } = createFakeDeps({ audio });
  const controller = new SpeechPlaybackController(deps);

  let doneCalls = 0;
  controller.speakText(
    { text: "hello", tts: VALID_TTS },
    { onDone: () => (doneCalls += 1) }
  );

  await flush();

  assert.equal(doneCalls, 1);
});

test("a server-resolved source posts only the opaque reference and plays the returned audio", async () => {
  const fetchCalls: Array<{ url: string; body: string }> = [];
  const fetchImpl = (async (input, init) => {
    fetchCalls.push({ url: String(input), body: String(init?.body) });
    return fakeResponse(true);
  }) as typeof fetch;

  const { deps, audio } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  let doneCalls = 0;
  const started = controller.speakText(
    {
      source: {
        endpoint: "/api/learning/vocabulary/speech",
        reference: "opaque-ref-1",
      },
    },
    { onDone: () => (doneCalls += 1) }
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
  assert.equal(doneCalls, 1);
});

test("a failed server-resolved source request calls onDone exactly once", async () => {
  const fetchImpl = (async () => fakeResponse(false)) as typeof fetch;
  const { deps } = createFakeDeps({ fetchImpl });
  const controller = new SpeechPlaybackController(deps);

  let doneCalls = 0;
  controller.speakText(
    { source: { endpoint: "/speech", reference: "opaque-ref-2" } },
    { onDone: () => (doneCalls += 1) }
  );

  await flush();
  assert.equal(doneCalls, 1);
});

test("primeSpeechPlayback is idempotent and swallows a rejected play()", () => {
  const audio = new FakeAudioElement();
  audio.playRejects = true;
  const { deps } = createFakeDeps({ audio });
  const controller = new SpeechPlaybackController(deps);

  assert.doesNotThrow(() => {
    controller.primeSpeechPlayback();
    controller.primeSpeechPlayback();
  });
  assert.equal(audio.playCount, 2);
});
