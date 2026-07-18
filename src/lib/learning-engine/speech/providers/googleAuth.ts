import { createSign } from "node:crypto";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "../../errors/TtsSynthesisError";
import { fetchUpstreamOrThrow } from "./fetchUpstreamOrThrow";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_TTS_OAUTH_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const ACCESS_TOKEN_TTL_SECONDS = 3600;
const ACCESS_TOKEN_REFRESH_MARGIN_SECONDS = 60;

export type GoogleServiceAccountCredentials = {
  clientEmail: string;
  privateKey: string;
  projectId?: string;
};

type CachedAccessToken = {
  accessToken: string;
  expiresAtMs: number;
};

const accessTokenCache = new Map<string, CachedAccessToken>();

function base64UrlEncodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signGoogleServiceAccountJwt(
  credentials: GoogleServiceAccountCredentials
): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: credentials.clientEmail,
    scope: GOOGLE_TTS_OAUTH_SCOPE,
    aud: GOOGLE_TOKEN_ENDPOINT,
    iat: issuedAt,
    exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS,
  };

  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(claims)}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(credentials.privateKey, "base64url");

  return `${signingInput}.${signature}`;
}

export function readGoogleServiceAccountCredentials(): GoogleServiceAccountCredentials {
  const clientEmail = process.env.GOOGLE_TTS_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_TTS_PRIVATE_KEY;

  if (!clientEmail || !rawPrivateKey) {
    throw new TtsConfigurationError(
      "google",
      "GOOGLE_TTS_CLIENT_EMAIL and GOOGLE_TTS_PRIVATE_KEY must be configured."
    );
  }

  return {
    clientEmail,
    privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
    projectId: process.env.GOOGLE_TTS_PROJECT_ID || undefined,
  };
}

export async function getGoogleAccessToken(
  credentials: GoogleServiceAccountCredentials,
  fetchImpl: typeof fetch
): Promise<string> {
  const cached = accessTokenCache.get(credentials.clientEmail);
  if (cached && cached.expiresAtMs > Date.now()) {
    return cached.accessToken;
  }

  const assertion = signGoogleServiceAccountJwt(credentials);

  const response = await fetchUpstreamOrThrow(
    "google",
    fetchImpl,
    GOOGLE_TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    },
    {
      networkFailure: "Failed to reach the Google OAuth token endpoint.",
      rejection: "Google OAuth token exchange was rejected.",
    }
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new TtsUpstreamError(
      "google",
      "Google OAuth token response was not valid JSON.",
      { upstreamStatus: response.status, cause }
    );
  }

  const parsed = payload as { access_token?: unknown; expires_in?: unknown };
  const accessToken = parsed?.access_token;
  if (typeof accessToken !== "string" || accessToken === "") {
    throw new TtsUpstreamError(
      "google",
      "Google OAuth token response did not include an access token.",
      { upstreamStatus: response.status }
    );
  }

  const expiresInSeconds =
    typeof parsed?.expires_in === "number"
      ? parsed.expires_in
      : ACCESS_TOKEN_TTL_SECONDS;

  accessTokenCache.set(credentials.clientEmail, {
    accessToken,
    expiresAtMs:
      Date.now() +
      Math.max(expiresInSeconds - ACCESS_TOKEN_REFRESH_MARGIN_SECONDS, 0) * 1000,
  });

  return accessToken;
}
