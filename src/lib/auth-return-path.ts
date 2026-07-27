const FALLBACK_PATH = "/dashboard";
const SIGN_IN_PATH = "/sign-in";

// Used only as a base for canonical URL parsing; never returned to callers.
// Any input that isn't a clean, single-rooted internal path fails to resolve
// against this origin and falls back to /dashboard.
const TRUSTED_ORIGIN = "https://auth-return-path.internal.invalid";

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function rawPathnamePortion(value: string): string {
  const queryIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  const candidates = [queryIndex, hashIndex].filter((index) => index >= 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : value.length;
  return value.slice(0, end);
}

// Decodes every raw path segment and rejects the value if any segment
// decodes to a slash, backslash, control character, or a "." / ".."
// traversal segment. This runs on the *raw* segments before the WHATWG URL
// parser gets a chance to normalize percent-encoded dot segments away,
// since that normalization would otherwise hide the confusion attempt from
// later checks. Returns the decoded segments for reuse by the sign-in loop
// check, or null when the value must be rejected.
function decodeAndValidateSegments(rawValue: string): string[] | null {
  const segments = rawPathnamePortion(rawValue).split("/");
  const decoded: string[] = [];

  for (const segment of segments) {
    let decodedSegment: string;
    try {
      decodedSegment = decodeURIComponent(segment);
    } catch {
      return null;
    }

    if (
      hasControlCharacter(decodedSegment) ||
      decodedSegment.includes("\\") ||
      decodedSegment.includes("/") ||
      decodedSegment === "." ||
      decodedSegment === ".."
    ) {
      return null;
    }

    decoded.push(decodedSegment);
  }

  return decoded;
}

function isSignInLoop(decodedPathname: string): boolean {
  const normalized = decodedPathname.toLowerCase();
  return normalized === SIGN_IN_PATH || normalized.startsWith(`${SIGN_IN_PATH}/`);
}

/**
 * Sanitizes an untrusted post-sign-in return path (e.g. the `callbackUrl`
 * search parameter) into a safe, root-relative, same-origin application
 * path. Anything that isn't a clean internal path — absolute or
 * protocol-relative URLs, non-HTTP schemes, raw/encoded backslash or slash
 * confusion, raw or encoded dot-segment traversal, control characters,
 * malformed percent-encoding, or a self-referential sign-in loop — falls
 * back to `/dashboard` rather than being partially trusted. The WHATWG URL
 * parser treats backslashes as path separators for special schemes and
 * silently normalizes encoded dot segments, so both are rejected on the raw
 * input before parsing rather than relied on to be caught by it.
 */
export function sanitizeReturnPath(rawValue: string | null | undefined): string {
  if (typeof rawValue !== "string") {
    return FALLBACK_PATH;
  }

  if (rawValue.trim().length === 0) {
    return FALLBACK_PATH;
  }

  if (hasControlCharacter(rawValue) || rawValue.includes("\\")) {
    return FALLBACK_PATH;
  }

  if (!rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return FALLBACK_PATH;
  }

  const decodedSegments = decodeAndValidateSegments(rawValue);
  if (!decodedSegments) {
    return FALLBACK_PATH;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawValue, TRUSTED_ORIGIN);
  } catch {
    return FALLBACK_PATH;
  }

  if (parsed.origin !== TRUSTED_ORIGIN) {
    return FALLBACK_PATH;
  }

  if (isSignInLoop(decodedSegments.join("/"))) {
    return FALLBACK_PATH;
  }

  const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;

  if (!safePath.startsWith("/") || safePath.startsWith("//")) {
    return FALLBACK_PATH;
  }

  return safePath;
}
