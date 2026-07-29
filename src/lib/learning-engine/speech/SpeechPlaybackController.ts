import type { SpeakActionPayload } from "@/types/learning";
import { chunkSpeechText, SpeechChunkingError } from "./chunkSpeechText";
import { normalizeSpeechQueue } from "./normalizeSpeechQueue";
import { SILENT_AUDIO_DATA_URI } from "./silentAudioDataUri";
import type {
  SpeechPlaybackFailure,
  SpeechPlaybackFailureStage,
} from "./speechPlaybackFailure";

type SpeechQueueItem = {
  endpoint: string;
  body: Record<string, unknown>;
};

export type SpeakTextOptions = {
  onDone?: () => void;
  onSuccess?: () => void;
  onFailure?: (failure: SpeechPlaybackFailure) => void;
};

export type SpeechPlaybackDeps = {
  isSupported: () => boolean;
  fetchImpl: typeof fetch;
  createAudioElement: () => HTMLAudioElement;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  reportFailure: (failure: SpeechPlaybackFailure) => void;
};

const TTS_ENDPOINT = "/api/tts";
const MAX_SAFE_ERROR_NAME_LENGTH = 64;

// Long public passages become multiple sequential provider-safe chunks split
// at natural boundaries; a passage with an unsplittable oversized token fails
// safely (no request is sent) instead of producing corrupted speech.
// Returns null only for a genuine preparation failure (the oversized-token
// case); an empty array means the input legitimately has nothing to say and
// is not a failure.
function createSpeechQueue(request: SpeakActionPayload): SpeechQueueItem[] | null {
  if ("source" in request) {
    return [
      {
        endpoint: request.source.endpoint,
        body: { reference: request.source.reference },
      },
    ];
  }

  try {
    return normalizeSpeechQueue(request.text).flatMap((text) =>
      chunkSpeechText(text).map((chunk) => ({
        endpoint: TTS_ENDPOINT,
        body: { text: chunk, tts: request.tts },
      }))
    );
  } catch (error) {
    if (error instanceof SpeechChunkingError) {
      return null;
    }
    throw error;
  }
}

// Only Error#name is ever read (e.g. "AbortError", "NotAllowedError") — never
// #message, which could echo response text, URLs, or other request detail.
function safeErrorName(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    error.name.length <= MAX_SAFE_ERROR_NAME_LENGTH &&
    /^[A-Za-z][A-Za-z0-9]*$/.test(error.name)
  ) {
    return error.name;
  }
  return undefined;
}

function readMediaErrorCode(audio: HTMLAudioElement): number | undefined {
  return Number.isInteger(audio.error?.code) ? audio.error?.code : undefined;
}

function isExplicitlyNonAudioBlob(blob: Blob): boolean {
  const mimeType = blob.type.trim().toLowerCase();
  return (
    mimeType !== "" &&
    mimeType !== "application/octet-stream" &&
    !mimeType.startsWith("audio/")
  );
}

export class SpeechPlaybackController {
  private deps: SpeechPlaybackDeps;
  private audioElement: HTMLAudioElement | null = null;
  private generation = 0;
  private activeAbortController: AbortController | null = null;
  private activeObjectUrl: string | null = null;
  private activeOnDone: (() => void) | null = null;
  private activeOnSuccess: (() => void) | null = null;
  private activeOnFailure: ((failure: SpeechPlaybackFailure) => void) | null =
    null;
  // Resolves the in-flight playBlob() promise as cancelled; cancelSpeech()
  // calls this so a mid-playback cancellation never leaves that promise
  // (and the runQueue awaiting it) unsettled forever.
  private cancelActivePlayback: (() => void) | null = null;

  constructor(deps: SpeechPlaybackDeps) {
    this.deps = deps;
  }

  speakText(request: SpeakActionPayload, options: SpeakTextOptions = {}): boolean {
    if (!this.deps.isSupported()) {
      this.failNewGeneration("unsupported", options);
      return false;
    }

    const queue = createSpeechQueue(request);
    if (queue === null) {
      this.failNewGeneration("request-preparation", options);
      return false;
    }
    if (queue.length === 0) {
      // Legitimately nothing to speak: not a failure, and any unrelated
      // active speech from an earlier request is left undisturbed.
      return false;
    }

    this.cancelSpeech();
    this.primeSpeechPlayback();

    const generation = ++this.generation;
    this.activeOnDone = options.onDone ?? null;
    this.activeOnSuccess = options.onSuccess ?? null;
    this.activeOnFailure = options.onFailure ?? null;

    void this.runQueue(generation, queue);

    return true;
  }

  primeSpeechPlayback(): void {
    if (!this.deps.isSupported()) {
      return;
    }

    try {
      const audio = this.ensureAudioElement();
      if (audio.src !== SILENT_AUDIO_DATA_URI) {
        audio.src = SILENT_AUDIO_DATA_URI;
      }
      const playResult = audio.play();
      if (playResult && typeof playResult.catch === "function") {
        // Best-effort autoplay primer only; its own rejection must never be
        // treated as (or trigger) a learner-visible playback failure.
        playResult.catch(() => {});
      }
    } catch {
      // A synchronous primer throw is swallowed for the same reason: this is
      // only a best-effort primer, and the subsequent real-audio attempt is
      // what actually determines success or failure.
    }
  }

  cancelSpeech(): void {
    this.generation += 1;

    this.activeAbortController?.abort();
    this.activeAbortController = null;

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.removeAttribute("src");
    }

    this.cancelActivePlayback?.();
    this.cancelActivePlayback = null;

    if (this.activeObjectUrl) {
      this.deps.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }

    this.activeOnDone = null;
    this.activeOnSuccess = null;
    this.activeOnFailure = null;
  }

  private ensureAudioElement(): HTMLAudioElement {
    if (!this.audioElement) {
      this.audioElement = this.deps.createAudioElement();
    }
    return this.audioElement;
  }

  private isStale(generation: number): boolean {
    return generation !== this.generation;
  }

  // Handles a failure detected before any queue could start (unsupported
  // audio, or a queue that could not be prepared safely). This is still a
  // new speak attempt, so it replaces any previous active generation exactly
  // like a normal successful call would, then immediately settles as failed.
  private failNewGeneration(
    stage: Extract<SpeechPlaybackFailureStage, "unsupported" | "request-preparation">,
    options: SpeakTextOptions
  ): void {
    this.cancelSpeech();
    const generation = ++this.generation;
    this.activeOnDone = options.onDone ?? null;
    this.activeOnSuccess = options.onSuccess ?? null;
    this.activeOnFailure = options.onFailure ?? null;
    this.settleFailure(generation, { requestId: generation, stage });
  }

  // Settles the active generation as a success: calls onSuccess then onDone
  // exactly once, never onFailure, and is a no-op for a stale generation.
  private settleSuccess(generation: number): void {
    if (this.isStale(generation)) {
      return;
    }
    const onSuccess = this.activeOnSuccess;
    const onDone = this.activeOnDone;
    this.activeOnDone = null;
    this.activeOnSuccess = null;
    this.activeOnFailure = null;
    onSuccess?.();
    onDone?.();
  }

  // Settles the active generation as a failure: reports the diagnostic once,
  // calls onFailure then onDone exactly once, never onSuccess, and is a
  // no-op for a stale generation (so a cancelled/replaced request can never
  // report or settle).
  private settleFailure(generation: number, failure: SpeechPlaybackFailure): void {
    if (this.isStale(generation)) {
      return;
    }
    this.deps.reportFailure(failure);
    const onFailure = this.activeOnFailure;
    const onDone = this.activeOnDone;
    this.activeOnDone = null;
    this.activeOnSuccess = null;
    this.activeOnFailure = null;
    onFailure?.(failure);
    onDone?.();
  }

  private async runQueue(
    generation: number,
    queue: SpeechQueueItem[]
  ): Promise<void> {
    for (const item of queue) {
      if (this.isStale(generation)) {
        return;
      }

      const succeeded = await this.speakOne(generation, item);
      if (!succeeded) {
        return;
      }
    }

    this.settleSuccess(generation);
  }

  private async speakOne(
    generation: number,
    item: SpeechQueueItem
  ): Promise<boolean> {
    const blob = await this.fetchSpeechAudio(generation, item);
    if (!blob || this.isStale(generation)) {
      return false;
    }
    return this.playBlob(generation, blob);
  }

  private async fetchSpeechAudio(
    generation: number,
    item: SpeechQueueItem
  ): Promise<Blob | null> {
    const controller = new AbortController();
    this.activeAbortController = controller;

    // Every terminal path below (success, request rejection, non-OK
    // response, or blob-read failure) releases this fetch's own controller
    // through this single `finally`. The identity check is required because
    // cancelSpeech() or a replacement speakText() call may already have
    // cleared or replaced `activeAbortController` by the time this settles;
    // this must only ever clear a field that still references its own
    // controller, never a newer generation's.
    try {
      let response: Response;
      try {
        response = await this.deps.fetchImpl(item.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body),
          signal: controller.signal,
        });
      } catch (error) {
        // cancelSpeech() bumps generation before aborting the controller, so
        // a stale generation here always means this rejection was caused by
        // our own cancellation/replacement, never a genuine request failure.
        if (this.isStale(generation)) {
          return null;
        }
        this.settleFailure(generation, {
          requestId: generation,
          stage: "request",
          errorName: safeErrorName(error),
        });
        return null;
      }

      if (this.isStale(generation)) {
        return null;
      }

      if (!response.ok) {
        this.settleFailure(generation, {
          requestId: generation,
          stage: "http-response",
          httpStatus: Number.isInteger(response.status)
            ? response.status
            : undefined,
        });
        return null;
      }

      let blob: Blob;
      try {
        blob = await response.blob();
      } catch (error) {
        if (this.isStale(generation)) {
          return null;
        }
        this.settleFailure(generation, {
          requestId: generation,
          stage: "audio-blob",
          errorName: safeErrorName(error),
        });
        return null;
      }

      if (this.isStale(generation)) {
        return null;
      }

      if (blob.size === 0 || isExplicitlyNonAudioBlob(blob)) {
        this.settleFailure(generation, {
          requestId: generation,
          stage: "audio-blob",
        });
        return null;
      }

      return blob;
    } finally {
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
    }
  }

  private playBlob(generation: number, blob: Blob): Promise<boolean> {
    let audio: HTMLAudioElement;
    let objectUrl: string | null = null;
    try {
      audio = this.ensureAudioElement();
      objectUrl = this.deps.createObjectURL(blob);
      this.activeObjectUrl = objectUrl;
      audio.src = objectUrl;
    } catch (error) {
      if (objectUrl && this.activeObjectUrl === objectUrl) {
        this.deps.revokeObjectURL(objectUrl);
        this.activeObjectUrl = null;
      }
      this.settleFailure(generation, {
        requestId: generation,
        stage: "audio-blob",
        errorName: safeErrorName(error),
      });
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;

      const cleanup = () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        // The sequential, await-driven queue guarantees this entry's cleanup
        // always runs before a later entry can reassign cancelActivePlayback,
        // so it is always still this entry's own cancellation callback here.
        this.cancelActivePlayback = null;
        if (this.activeObjectUrl === objectUrl) {
          this.deps.revokeObjectURL(objectUrl);
          this.activeObjectUrl = null;
        }
      };

      const settleCancelled = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(false);
      };

      const settleSucceeded = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(true);
      };

      const settleFailed = (failure: SpeechPlaybackFailure) => {
        if (settled) return;
        settled = true;
        cleanup();
        this.settleFailure(generation, failure);
        resolve(false);
      };

      const onEnded = () => {
        if (this.isStale(generation)) {
          settleCancelled();
          return;
        }
        settleSucceeded();
      };

      const onError = () => {
        if (this.isStale(generation)) {
          settleCancelled();
          return;
        }
        settleFailed({
          requestId: generation,
          stage: "audio-decode",
          mediaErrorCode: readMediaErrorCode(audio),
        });
      };

      this.cancelActivePlayback = settleCancelled;
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);

      try {
        const playResult = audio.play();
        if (playResult && typeof playResult.catch === "function") {
          playResult.catch((error) => {
            if (this.isStale(generation)) {
              settleCancelled();
              return;
            }
            settleFailed({
              requestId: generation,
              stage: "audio-play",
              errorName: safeErrorName(error),
            });
          });
        }
      } catch (error) {
        settleFailed({
          requestId: generation,
          stage: "audio-play",
          errorName: safeErrorName(error),
        });
      }
    });
  }
}
