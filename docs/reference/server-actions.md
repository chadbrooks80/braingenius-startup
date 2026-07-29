# Server Actions

## `src/actions/register.ts`

### `registerUser(formData)`

- Input: `email` and `password` from `FormData`; Zod requires a valid email and eight-character minimum.
- Auth: public sign-up action.
- Side effects: for an email with no existing account, bcrypt-hashes the password and creates a parent user plus three-day free-trial subscription; a concurrent duplicate create is caught and treated the same as an existing account. Whenever the email now belongs to an unverified account (new or pre-existing), creates a hashed 10-minute verification code and attempts Resend delivery. An existing verified account, or any other existing account's password/verification/subscription/onboarding state, is never modified or sent a new-account email.
- Return: `{ success: true }` for every syntactically valid email, whether new, existing unverified, or existing verified, so the response never reveals stored account state. Validation failures and unexpected errors return `{ success: false, error }`. Email delivery failure is logged after account/code creation and still returns success so resend can recover.
- Consumers/evidence: `/sign-up` (neutral post-acceptance copy that doesn't claim the address was new), `/playground/register`; `tests/auth/registerUser.test.ts`.

## `src/actions/checkout.ts`

### `createCheckoutSession(plan)`

- Input: typed `CheckoutPlan`, `"MONTHLY" | "LIFETIME"`.
- Auth: requires a server session and derives user ID from it.
- Side effects: validates the plan, reads the user/subscription, resolves a trusted application origin, and creates a Stripe subscription-mode or payment-mode Checkout Session using the matching server-configured price. Reuses a stored Stripe customer when present; a new lifetime Checkout explicitly creates one.
- Return: success with Stripe-hosted URL or safe failure.
- Return URLs: success uses `/getting-started?checkout=success&session_id={CHECKOUT_SESSION_ID}`; cancel uses `/getting-started?checkout=canceled`. Neither URL contains identity, price, tier, payment, or entitlement claims.
- Consumers/evidence: `PlanStep`; checkout verification is covered by `tests/billing/checkoutConfirmation.test.ts` and the real return-page boundary by `tests/auth/gettingStartedPage.test.ts`. Successful action return does not itself update entitlement.

## `src/actions/onboarding.ts`

All mutations derive user ID from `getServerSession`. Every action returns the shared `OnboardingActionResult<T>` contract from `src/lib/onboarding-funnel.ts`: `{ status: "success", data }`, `{ status: "recovery", redirectTo }` (stale/duplicate/out-of-order/completed — the account's actual current-state destination), `{ status: "unauthenticated" }`, or `{ status: "error", error }`.

### `completeWelcomeVideoStep()`

Requires a session, then calls `advanceParentOnboardingStep` to advance only when the database still says role `PARENT`, step `WELCOME_VIDEO`, and incomplete onboarding. Consumed by `WelcomeVideoStep`.

### `saveProfile(input)`

Validates required `fName` and optional `lName`, then calls `advanceParentOnboardingStep` with the profile fields as `extraData` so the profile write and the `PROFILE → PLAN` transition happen in one conditional `updateMany` — they succeed or fail together. Consumed by `ProfileStep`.

### `continueWithFreeTrial()`

Requires a session and advances `PLAN` only when the database still says `PLAN`. Consumed by `PlanStep`; the subscription was already created during account creation.

### `checkUsernameAvailability(username)`

Requires the signed-in database `PARENT` to still be on `CHILDREN` with incomplete onboarding (`requireParentAtStep`), then validates at least three lowercase alphanumeric characters and checks the unique `User.username`. Returns `{ available: false }` for invalid input, an unauthorized caller, or a database failure. Consumed by `ChildrenStep`.

### `suggestUsernames(base, count = 3)`

Requires the same `CHILDREN`-step gate as `checkUsernameAvailability`, validates a non-empty base and integer count from 1 to 5, normalizes to lowercase alphanumerics, then makes up to 20 database-checked random four-digit candidates. Returns availability plus suggestions. Consumed by `ChildrenStep`.

### `createChildAccount(input)`

Validates name, lowercase-alphanumeric username, eight-character password, and reset flag; requires a session; bcrypt-hashes the password before opening a transaction. Inside the transaction it takes a Postgres row lock on the parent (`lockUserRow`), re-checks role/step/completion and the two-child limit against that locked row, then creates the `CHILD` user and `ParentStudent` relation together. A unique-username race is caught and returned as a safe conflict. Returns the new child summary. Consumed by `ChildrenStep`.

### `finishChildrenStep()`

Requires a session and advances `CHILDREN` to `COMPLETE` (which sets `onboardingCompleted`) only when the database still says `CHILDREN` with incomplete onboarding. Consumed by both Skip and Finish controls in `ChildrenStep`; the component then calls `session.update()` only to trigger a refresh (it sends no onboarding claims) and routes to `/dashboard`.

## Validation and authorization

Every action authorizes against the signed-in user's current database record at the moment of the write, not a caller-supplied or JWT-cached step. `advanceParentOnboardingStep` matches user ID, database role `PARENT`, the required stored step, and `onboardingCompleted = false` in one conditional `updateMany`; zero matched rows returns a `recovery` result instead of erroring blindly or silently succeeding. `createChildAccount` additionally re-verifies those conditions and the two-child limit inside a locked transaction so concurrent requests for the same parent cannot both pass.
