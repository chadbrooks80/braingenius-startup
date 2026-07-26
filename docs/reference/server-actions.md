# Server Actions

## `src/actions/register.ts`

### `registerUser(formData)`

- Input: `email` and `password` from `FormData`; Zod requires a valid email and eight-character minimum.
- Auth: public sign-up action.
- Side effects: rejects an existing email, bcrypt-hashes the password, creates a parent user and three-day free-trial subscription, creates a hashed 10-minute verification code, and attempts Resend delivery.
- Return: `{ success: true }` or `{ success: false, error }`. Email failure is logged after account/code creation and still returns success so resend can recover.
- Consumers/evidence: `/sign-up`, `/playground/register`; no focused action test.

## `src/actions/checkout.ts`

### `createCheckoutSession(plan)`

- Input: typed `CheckoutPlan`, `"MONTHLY" | "LIFETIME"`.
- Auth: requires a server session and derives user ID from it.
- Side effects: reads the user/subscription and creates a Stripe subscription-mode or payment-mode Checkout Session using the matching server-configured price. Reuses a stored Stripe customer when present.
- Return: success with Stripe-hosted URL or safe failure.
- Consumers/evidence: `PlanStep`; no focused action test. Successful return does not itself update entitlement.

## `src/actions/onboarding.ts`

All mutations derive user ID from `getServerSession`. Errors return safe `{ success: false, error }` results.

### `completeWelcomeVideoStep()`

Requires a session and advances `WELCOME_VIDEO` to the next funnel step. Consumed by `WelcomeVideoStep`.

### `saveProfile(input)`

Validates required `fName` and optional `lName`, updates first/last/composed name, then advances `PROFILE`. Consumed by `ProfileStep`. The update and step advance are separate database operations, not one transaction.

### `continueWithFreeTrial()`

Requires a session and advances `PLAN`. Consumed by `PlanStep`; the subscription was already created during account creation.

### `checkUsernameAvailability(username)`

Validates at least three lowercase alphanumeric characters and checks the unique `User.username`. Returns `{ available: false }` for invalid input or database failure. Consumed by `ChildrenStep`.

### `suggestUsernames(base, count = 3)`

Validates a non-empty base and integer count from 1 to 5, normalizes to lowercase alphanumerics, then makes up to 20 database-checked random four-digit candidates. Returns availability plus suggestions. Consumed by `ChildrenStep`.

### `createChildAccount(input)`

Validates name, lowercase-alphanumeric username, eight-character password, and reset flag; requires a session; checks username and the two-child limit; bcrypt-hashes the password. A Prisma transaction creates a `CHILD` user and `ParentStudent` relation. Returns the new child summary. Consumed by `ChildrenStep`.

### `finishChildrenStep()`

Requires a session and advances `CHILDREN` to `COMPLETE`, which sets `onboardingCompleted`. Consumed by both Skip and Finish controls in `ChildrenStep`; the component then updates session claims and routes to `/dashboard`.

## Validation and authorization limitations

Actions perform their own server validation, but `advanceOnboardingStep` does not compare the database user's actual current step with the `currentStep` argument. Callers supply constant expected steps. Username suggestion/availability require a valid session only indirectly where they are used; those two exported actions themselves do not authenticate.
