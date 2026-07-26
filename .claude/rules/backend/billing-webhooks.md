---
paths:
  - "src/actions/{checkout,register,onboarding}.ts"
  - "src/lib/{stripe,subscription}.ts"
  - "src/app/api/webhooks/stripe/**/*"
  - "src/components/onboarding/PlanStep.tsx"
  - "src/app/(auth)/(onboarding)/getting-started/page.tsx"
  - "src/auth.ts"
  - "prisma/schema.prisma"
---

# Billing and Webhooks

## Ownership

- Keep Stripe credentials, price configuration, checkout creation, webhook verification, and subscription persistence server-only.
- Reuse the existing Stripe client and subscription helpers.
- Do not introduce a second billing state store or let browser state become authoritative.
- The database records application access state; verified Stripe events are authoritative for Stripe subscription lifecycle changes.

## Checkout

- Derive the customer and user identity from the authenticated server session.
- Do not trust browser-provided user IDs, prices, product identifiers, subscription tiers, currencies, trial dates, or entitlement decisions.
- Select approved Stripe prices from server-controlled configuration.
- Unknown or unapproved Stripe price IDs must fail closed and must never grant or preserve paid access.
- Validate success and cancel return paths as approved application URLs.
- Do not grant access merely because the browser returned from Checkout.
- Treat Checkout success query parameters and return URLs as untrusted navigation state. Never advance billing, entitlement, or onboarding state from `checkout=success` without verifying the Checkout Session or re-reading subscription state established by a verified webhook.
- Repeated checkout requests must not create unintended duplicate customers or subscriptions.

## Webhooks

- Verify the Stripe signature against the raw request body before parsing or acting on an event.
- Reject an invalid or missing signature without updating application state.
- Handle only event types the application explicitly supports.
- Make event handling idempotent. Stripe may deliver the same event more than once or out of order.
- Validate required metadata and identifiers before using them to locate a user or subscription.
- Do not log webhook secrets, full payment details, or unnecessary personal information.
- Return an error when required processing fails; do not acknowledge a failed update as successful.

## Subscription State

- Keep `stripeCustomerId`, `stripeSubscriptionId`, price, status, period end, cancellation state, tier, and trial data internally consistent.
- Use transactions or idempotent upserts when multiple records or fields must change together.
- A canceled, unpaid, incomplete, or failed subscription must not accidentally retain paid access.
- Preserve the existing free-trial creation flow for new accounts unless the requested feature intentionally changes it.
- Do not infer entitlement solely from a client-visible plan label.

## User Interface

- UI plan names, prices, and descriptions must match the approved server-side product configuration.
- Disable duplicate checkout actions while a request is pending.
- Display safe, recoverable errors without exposing Stripe payloads or internal identifiers.
- Do not promise successful payment or activation before the server confirms it.

## Verification

- Test checkout authentication, approved price selection, duplicate clicks, checkout failure, valid webhook signatures, invalid signatures, duplicate events, missing metadata, and relevant subscription transitions.
- Confirm failed or forged events cannot grant access.
- Use Stripe test-mode fixtures or the existing test boundary; never exercise production billing during normal development verification.
