import "server-only";
import { TtsUpstreamError } from "../../errors/TtsSynthesisError";
import type { TtsProviderName } from "../../errors/TtsSynthesisError";

// Bounded reading for untrusted provider response bodies. Nothing here may
// call unbounded response.json()/text()/arrayBuffer(): a valid oversized
// Content-Length is rejected before any buffering, and the streamed byte
// count enforces the limit regardless of missing, malformed, negative, or
// falsely small declared lengths.

type BoundedReadDetails = {
  model?: string;
  voice?: string;
};

function oversizeError(
  provider: TtsProviderName,
  message: string,
  status: number,
  details?: BoundedReadDetails
): TtsUpstreamError {
  return new TtsUpstreamError(provider, message, {
    ...details,
    upstreamStatus: status,
  });
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error("The upstream response was aborted.");
}

async function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (!signal) {
    return reader.read();
  }
  if (signal.aborted) {
    void reader.cancel().catch(() => {});
    throw abortReason(signal);
  }

  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      void reader.cancel().catch(() => {});
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    return await Promise.race([reader.read(), aborted]);
  } finally {
    if (onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}

/**
 * Reads a provider response body incrementally and returns at most maxBytes
 * bytes. The reader is cancelled and a typed safe upstream error is thrown
 * as soon as the running total exceeds the limit. Response bytes are never
 * logged.
 */
export async function readBoundedResponseBody(
  provider: TtsProviderName,
  response: Response,
  maxBytes: number,
  oversizeMessage: string,
  details?: BoundedReadDetails,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const declaredLength = response.headers.get("Content-Length");
  if (declaredLength !== null) {
    const parsed = Number(declaredLength);
    // Only a valid declared length larger than the limit is trusted, and
    // only to reject early; anything else falls through to streaming.
    if (Number.isInteger(parsed) && parsed > maxBytes) {
      await response.body?.cancel().catch(() => {});
      throw oversizeError(provider, oversizeMessage, response.status, details);
    }
  }

  const body = response.body;
  if (!body) {
    return new Uint8Array(0);
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (;;) {
    const { done, value } = await readChunk(reader, signal);
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => {});
      throw oversizeError(provider, oversizeMessage, response.status, details);
    }
    chunks.push(value);
  }

  return new Uint8Array(Buffer.concat(chunks));
}
