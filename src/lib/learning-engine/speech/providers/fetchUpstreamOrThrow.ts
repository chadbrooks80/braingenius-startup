import "server-only";
import { TtsUpstreamError } from "../../errors/TtsSynthesisError";
import type { TtsProviderName } from "../../errors/TtsSynthesisError";
import { fetchWithTimeout } from "./fetchWithTimeout";

export async function fetchUpstreamOrThrow<T>(
  provider: TtsProviderName,
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  messages: { networkFailure: string; rejection: string },
  consume: (response: Response, signal: AbortSignal) => Promise<T>,
  details?: { model?: string; voice?: string },
  timeoutMs?: number
): Promise<T> {
  try {
    return await fetchWithTimeout(
      fetchImpl,
      input,
      init,
      async (response, signal) => {
        if (!response.ok) {
          throw new TtsUpstreamError(provider, messages.rejection, {
            ...details,
            upstreamStatus: response.status,
          });
        }
        return consume(response, signal);
      },
      timeoutMs
    );
  } catch (cause) {
    if (cause instanceof TtsUpstreamError) {
      throw cause;
    }
    throw new TtsUpstreamError(provider, messages.networkFailure, {
      ...details,
      cause,
    });
  }
}
