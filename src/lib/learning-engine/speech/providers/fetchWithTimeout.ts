import "server-only";

export const UPSTREAM_TIMEOUT_MS = 10_000;

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error("The upstream operation was aborted.");
}

/**
 * Keeps one deadline active from request dispatch through response
 * consumption. Clearing the timer only after the consumer finishes prevents
 * a headers-only response from escaping the provider's timeout contract.
 */
export async function fetchWithTimeout<T>(
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  consume: (response: Response, signal: AbortSignal) => Promise<T>,
  timeoutMs: number = UPSTREAM_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error("The upstream operation timed out.")),
    timeoutMs
  );

  try {
    const response = await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
    if (controller.signal.aborted) {
      throw abortReason(controller.signal);
    }
    return await consume(response, controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}
