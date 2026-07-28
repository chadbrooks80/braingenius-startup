type FakeSessionUser = { id: string };

let currentUserId: string | undefined;

/** Controls what `getServerSession` resolves to for the rest of this test. */
export function __setSessionUserId(userId: string | undefined): void {
  currentUserId = userId;
}

export async function getServerSession(): Promise<{ user: FakeSessionUser } | null> {
  return currentUserId ? { user: { id: currentUserId } } : null;
}

// src/auth.ts only calls `NextAuth(authOptions)` to build the handler
// exported from the NextAuth catch-all API route. No test in this
// repository exercises that handler directly, so a harmless stand-in
// avoids resolving the real package here (which would recurse back into
// this same module-resolution hook).
export default function NextAuth(): Record<string, never> {
  return {};
}
