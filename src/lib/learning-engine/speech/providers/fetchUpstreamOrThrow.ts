import { TtsUpstreamError } from "../../errors/TtsSynthesisError";
import type { TtsProviderName } from "../../errors/TtsSynthesisError";
import { fetchWithTimeout } from "./fetchWithTimeout";

export async function fetchUpstreamOrThrow(
  provider: TtsProviderName,
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  messages: { networkFailure: string; rejection: string },
  details?: { model?: string; voice?: string }
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchWithTimeout(fetchImpl, input, init);
  } catch (cause) {
    throw new TtsUpstreamError(provider, messages.networkFailure, {
      ...details,
      cause,
    });
  }

  if (!response.ok) {
    throw new TtsUpstreamError(provider, messages.rejection, {
      ...details,
      upstreamStatus: response.status,
    });
  }

  return response;
}
