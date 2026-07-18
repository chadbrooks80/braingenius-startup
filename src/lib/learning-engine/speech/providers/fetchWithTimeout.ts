const UPSTREAM_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
