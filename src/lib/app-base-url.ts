import "server-only";

/**
 * Resolves a single candidate into a trusted origin: parsed with the `URL`
 * API, `http:`/`https:` only, and never carrying embedded credentials.
 * Returns just the origin (protocol + host + port) -- any configured path,
 * query, or fragment on the candidate is intentionally dropped.
 */
function parseTrustedOrigin(candidate: string | undefined): string | null {
  if (!candidate) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (parsed.username !== "" || parsed.password !== "") {
    return null;
  }

  return parsed.origin;
}

/**
 * Resolves the application's trusted base origin from server configuration
 * only -- never from a request's `Host`, `Origin`, `Referer`, or any
 * forwarded-host header. Candidate order: `NEXTAUTH_URL`, then
 * `NEXT_PUBLIC_APP_URL`, then `http://localhost:3000` outside production.
 * Returns `null` when no candidate resolves to a usable origin (always a
 * real gap in production, since the localhost fallback never applies
 * there).
 */
export function resolveAppBaseUrl(): string | null {
  const candidates = [process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_APP_URL];

  if (process.env.NODE_ENV !== "production") {
    candidates.push("http://localhost:3000");
  }

  for (const candidate of candidates) {
    const origin = parseTrustedOrigin(candidate);
    if (origin) {
      return origin;
    }
  }

  return null;
}

/**
 * Builds the password-reset link from the trusted origin using the `URL`
 * API throughout, so `token` and `email` are always escaped through
 * `URLSearchParams` rather than manual string concatenation. Returns `null`
 * when no trusted origin is configured -- callers must not create or send
 * an unusable link in that case.
 */
export function buildPasswordResetUrl(token: string, email: string): URL | null {
  const origin = resolveAppBaseUrl();
  if (!origin) {
    return null;
  }

  const url = new URL("/reset-password", origin);
  url.searchParams.set("token", token);
  url.searchParams.set("email", email);
  return url;
}
