import type { SpeakActionPayload } from "@/types/learning";
import { normalizeSpeechQueue } from "./normalizeSpeechQueue";
import { SILENT_AUDIO_DATA_URI } from "./silentAudioDataUri";

type SpeechQueueItem = {
  endpoint: string;
  body: Record<string, unknown>;
};

export type SpeakTextOptions = {
  onDone?: () => void;
};

export type SpeechPlaybackDeps = {
  isSupported: () => boolean;
  fetchImpl: typeof fetch;
  createAudioElement: () => HTMLAudioElement;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

const TTS_ENDPOINT = "/api/tts";

function createSpeechQueue(request: SpeakActionPayload): SpeechQueueItem[] {
  if ("source" in request) {
    return [
      {
        endpoint: request.source.endpoint,
        body: { reference: request.source.reference },
      },
    ];
  }

  return normalizeSpeechQueue(request.text).map((text) => ({
    endpoint: TTS_ENDPOINT,
    body: { text, tts: request.tts },
  }));
}

export class SpeechPlaybackController {
  private deps: SpeechPlaybackDeps;
  private audioElement: HTMLAudioElement | null = null;
  private generation = 0;
  private activeAbortController: AbortController | null = null;
  private activeObjectUrl: string | null = null;
  private activeOnDone: (() => void) | null = null;
  // Resolves the in-flight playBlob() promise as cancelled; cancelSpeech()
  // calls this so a mid-playback cancellation never leaves that promise
  // (and the runQueue awaiting it) unsettled forever.
  private cancelActivePlayback: (() => void) | null = null;

  constructor(deps: SpeechPlaybackDeps) {
    this.deps = deps;
  }

  speakText(request: SpeakActionPayload, options: SpeakTextOptions = {}): boolean {
    if (!this.deps.isSupported()) {
      return false;
    }

    const queue = createSpeechQueue(request);
    if (queue.length === 0) {
      return false;
    }

    this.cancelSpeech();
    this.primeSpeechPlayback();

    const generation = ++this.generation;
    this.activeOnDone = options.onDone ?? null;

    void this.runQueue(generation, queue);

    return true;
  }

  primeSpeechPlayback(): void {
    if (!this.deps.isSupported()) {
      return;
    }

    const audio = this.ensureAudioElement();
    if (audio.src !== SILENT_AUDIO_DATA_URI) {
      audio.src = SILENT_AUDIO_DATA_URI;
    }

    const playResult = audio.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {});
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

    this.completeGeneration(generation);
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

    let response: Response;
    try {
      response = await this.deps.fetchImpl(item.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
        signal: controller.signal,
      });
    } catch {
      this.completeGeneration(generation);
      return null;
    }

    if (this.isStale(generation)) {
      return null;
    }

    if (!response.ok) {
      this.completeGeneration(generation);
      return null;
    }

    try {
      return await response.blob();
    } catch {
      this.completeGeneration(generation);
      return null;
    }
  }

  private playBlob(generation: number, blob: Blob): Promise<boolean> {
    const objectUrl = this.deps.createObjectURL(blob);
    this.activeObjectUrl = objectUrl;

    const audio = this.ensureAudioElement();
    audio.src = objectUrl;

    return new Promise<boolean>((resolve) => {
      let settled = false;

      const settle = (succeeded: boolean) => {
        if (settled) {
          return;
        }
        settled = true;

        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        // The sequential, await-driven queue guarantees this entry's settle()
        // always runs before a later entry can reassign cancelActivePlayback,
        // so it is always still this entry's own settleAsCancelled here.
        this.cancelActivePlayback = null;
        if (this.activeObjectUrl === objectUrl) {
          this.deps.revokeObjectURL(objectUrl);
          this.activeObjectUrl = null;
        }

        resolve(succeeded);
      };

      const onEnded = () => settle(!this.isStale(generation));

      const onError = () => {
        this.completeGeneration(generation);
        settle(false);
      };

      const settleAsCancelled = () => settle(false);

      this.cancelActivePlayback = settleAsCancelled;
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);

      const playResult = audio.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(() => {
          this.completeGeneration(generation);
          settle(false);
        });
      }
    });
  }

  private completeGeneration(generation: number): void {
    if (this.isStale(generation)) {
      return;
    }
    const onDone = this.activeOnDone;
    this.activeOnDone = null;
    onDone?.();
  }
}
