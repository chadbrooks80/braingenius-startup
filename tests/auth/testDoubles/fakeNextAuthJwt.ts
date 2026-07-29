type FakeToken = Record<string, unknown> | null;

let currentToken: FakeToken = null;

/** Controls what `getToken` resolves to for the rest of this test. */
export function __setToken(token: FakeToken): void {
  currentToken = token;
}

export async function getToken(): Promise<FakeToken> {
  return currentToken;
}
