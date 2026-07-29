import "server-only";
import { createSign } from "node:crypto";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "../../errors/TtsSynthesisError";
import { TTS_MAX_GOOGLE_OAUTH_JSON_BYTES } from "../ttsUsagePolicy";
import { fetchUpstreamOrThrow } from "./fetchUpstreamOrThrow";
import { readBoundedResponseBody } from "./readBoundedResponseBody";

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
  fetchImpl: typeof fetch,
  upstreamTimeoutMs?: number
): Promise<string> {
  const cached = accessTokenCache.get(credentials.clientEmail);
  if (cached && cached.expiresAtMs > Date.now()) {
    return cached.accessToken;
  }

  const assertion = signGoogleServiceAccountJwt(credentials);

  const token = await fetchUpstreamOrThrow(
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
    },
    async (response, signal) => {
      const contentType = response.headers
        .get("Content-Type")
        ?.split(";", 1)[0]
        .trim();
      if (contentType !== "application/json") {
        throw new TtsUpstreamError(
          "google",
          "Google OAuth token response was not JSON.",
          { upstreamStatus: response.status }
        );
      }

      const rawBody = await readBoundedResponseBody(
        "google",
        response,
        TTS_MAX_GOOGLE_OAUTH_JSON_BYTES,
        "Google OAuth token response was oversized.",
        undefined,
        signal
      );

      let payload: unknown;
      try {
        payload = JSON.parse(Buffer.from(rawBody).toString("utf8"));
      } catch (cause) {
        throw new TtsUpstreamError(
          "google",
          "Google OAuth token response was not valid JSON.",
          { upstreamStatus: response.status, cause }
        );
      }

      const parsed = payload as {
        access_token?: unknown;
        expires_in?: unknown;
      };
      if (typeof parsed.access_token !== "string" || parsed.access_token === "") {
        throw new TtsUpstreamError(
          "google",
          "Google OAuth token response did not include an access token.",
          { upstreamStatus: response.status }
        );
      }

      return {
        accessToken: parsed.access_token,
        expiresInSeconds:
          typeof parsed.expires_in === "number"
            ? parsed.expires_in
            : ACCESS_TOKEN_TTL_SECONDS,
      };
    },
    undefined,
    upstreamTimeoutMs
  );

  accessTokenCache.set(credentials.clientEmail, {
    accessToken: token.accessToken,
    expiresAtMs:
      Date.now() +
      Math.max(
        token.expiresInSeconds - ACCESS_TOKEN_REFRESH_MARGIN_SECONDS,
        0
      ) *
        1000,
  });

  return token.accessToken;
}
