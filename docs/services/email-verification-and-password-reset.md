# Email Verification and Password Reset

## Ownership and providers

`src/lib/auth-tokens.ts` owns token generation, hashing, and durations. `src/lib/email.ts` lazily creates a Resend client with `RESEND_API_KEY` and sends from `EMAIL_FROM`. The routes under `src/app/api/auth/` own verification and reset HTTP behavior.

## Email verification

Credentials registration creates a random four-digit code, stores only its SHA-256 hash, and sets a 10-minute expiry. Verification loads the latest unused code for the email, rejects expiry or five prior failed attempts, increments attempts for a mismatch, and transactionally sets `emailVerified`, advances to `WELCOME_VIDEO`, and marks the code used on success.

Resend enforces 60 seconds since the latest code. For an existing unverified user it marks all unused codes used, creates a replacement, and attempts delivery. Unknown/already-verified accounts get generic success. A rate-limited request gets a specific `429`.

## Password reset

Request validates email but always returns generic success. For an existing credentials account outside the 60-second interval it creates a cryptographically random 32-byte token, stores only the SHA-256 hash, expires it after one hour, and emails a URL based on `NEXT_PUBLIC_APP_URL`.

Confirmation validates email/token/password, looks up the hash, and rejects missing, expired, used, or wrong-email tokens with one safe message. On success a transaction bcrypt-hashes the new password and marks every unused token for that user used.

## Failure behavior and limitations

Email provider failures are logged and do not reverse already-created accounts/codes/tokens. This permits resend but can leave stored credentials with no delivered message. Reset-request invalid JSON/input also returns success. Reset tokens are invalidated on successful use, not when a newer token is issued.

There are no focused automated tests for these routes or the Resend adapter. UI forms provide Zod validation and pending/error states, but server routes remain authoritative.
