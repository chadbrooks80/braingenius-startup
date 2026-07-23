## 2026-07-23 10:00

- Completed final cleanup of the Host/Learning Engine theme unification in `src/app/globals.css` on `feature/learning-theme-batch-3`, following the batch 1 (`3171438`) and batch 2 (`a1cbffb`) Learning Engine component migrations
- Removed the now-unused "TEMPORARY LEGACY — LEARNING ENGINE COLOR NAMES" `:root` block, the "TEMPORARY SHARED SURFACES" `:root` block, and the "TAILWIND V4 — TEMPORARY LEGACY COLOR UTILITIES" `@theme inline` block, since every component that referenced them has been migrated to the unified `ColorToken` classes
- Verified via repo-wide grep that no `.tsx`/`.ts`/`.css` files reference the removed legacy CSS variables or Tailwind utility classes (e.g. `--cyan`, `--lime`, `--hairline`, `bg-white`, `text-cyan`, `border-lime`) before deleting them
- Trimmed the file header comment and stale migration-in-progress comments now that the color migration is finished

## 2026-07-22 00:01

- Migrated third batch of Host components — the auth pages (`sign-in`, `sign-up`, `forgot-password`, `reset-password`, `verify-email`) and onboarding components (`OnboardingShell`, `ProfileStep`, `PlanStep`, `ChildrenStep`, `WelcomeVideoStep`) — from raw `var(--color-*)` Tailwind arbitrary values to the unified `ColorToken` theme utility classes (e.g. `bg-surface`, `bg-background`, `text-heading`, `text-muted`, `text-primary-strong`, `border-heading/20`)
- Continues the theme unification work on `feature/host-theme-batch-3`, on top of batch 1 (`040eb0d`) and batch 2 (`4fe6329`)

## 2026-07-22 00:00

- Migrated second batch of Host components (`CTASection`, `ExampleBlock`, `FeatureCheckCard`, `FeatureSection`, `Hero`, `HowItWorksSection`, `TestimonialCard`, `TestimonialsSection`, `TrustSection`, `WordGeneratorSection`) from raw `var(--color-*)` Tailwind arbitrary values to the unified `ColorToken` theme utility classes (e.g. `bg-primary`, `text-text`, `text-secondary`, `text-muted`, `text-heading`, `text-surface`, `text-energy`)
- Continues the theme unification work started in `feature/host-theme-batch-2` on top of batch 1 (commit `040eb0d`)

## 2026-07-18 21:46

- Merged the standalone Learning Engine into the BrainGenius host on `feature/stage-2b-learning-engine-integration`
- Migrated components to `src/learning-engine-components`, modules to `src/learning-modules`, types to `src/types`, and libs to `src/lib/learning-engine` and `src/lib/random`
- Moved the learning route/layout to `src/app/(app)/(learning)`, vocabulary and TTS API routes to `src/app/api/learning` and `src/app/api/tts`, and the playground to `src/app/le-playground`
- Copied Learning Engine tests into host-level `tests/`, replaced `src/lib/emojis.ts` placeholder with the real emoji constants
- Imported the six Learning Engine Claude skills under `.claude/skills` with an `le-` prefix and matching `.codex/skills` pointers
- Copied Learning Engine `context/` and `docs/` into `le-context/` and `le-docs/` at the host root, byte-for-byte
- Repaired migrated import paths to the host `@/` alias and confirmed no active host source imports from `references/learning-engine`

## 2026-06-25 18:15

- Redesigned onboarding CHILDREN step so children get real, loginable accounts (first/last name, username, password) instead of a bare placeholder `User` row
- Added `mustResetPassword Boolean @default(false)` to `User` (migration `add_must_reset_password`)
- Scoped `EMAIL_NOT_VERIFIED` check in `src/auth.ts` `authorize()` to skip `role === "CHILD"` accounts
- `src/actions/onboarding.ts`: added `checkUsernameAvailability`, `suggestUsernames`, `createChildAccount` (bcrypt hash, transaction creating `User` + `ParentStudent`, server-side 2-child cap), `finishChildrenStep`
- Built reusable `Modal` and `PasswordInput` UI components with docs in `docs/components/`
- Rewrote `ChildrenStep.tsx`: per-child modal flow with username availability/suggestions, auto-generate, "Skip for now" and "Finish setup" actions, max 2 children with slot 2 locked until child 1 created
- Verified end-to-end: add child 1 unlocks slot 2, username collision/suggestions work, mustResetPassword checkbox persists, skip-for-now completes onboarding with 0 children, created child can sign in at /sign-in

## 2026-06-25 17:30

- Built funnel-based signup/onboarding system replacing scattered hardcoded redirects
- Added `OnboardingStep` enum and `onboardingStep` field to `User` model (migration included, with backfill for existing users)
- Created `src/lib/onboarding-funnel.ts` as the single source of truth for step order, route resolution (`getOnboardingRoute`), and step advancement (`advanceOnboardingStep`)
- Added step components: `WelcomeVideoStep`, `ProfileStep`, `PlanStep`, `ChildrenStep`, wrapped in `OnboardingShell`; `/getting-started` renders based on current step
- Email/password users start at `VERIFY_EMAIL`; Google users (new and account-linked) start at `WELCOME_VIDEO` via adapter `createUser`/`linkAccount` overrides in `src/auth.ts`
- `proxy.ts` and `/getting-started` both route through `getOnboardingRoute` (no duplicated routing logic)
- Free trial and Stripe checkout success both advance `PLAN` → `CHILDREN`; completing children advances to `COMPLETE` and sets `onboardingCompleted`
- Documented all new components in `docs/components/`
- Passed audit (including a follow-up pass fixing duplicated routing logic, Google account-linking onboarding state, and an enum string-literal nit)

## 2026-06-25 04:53

- Implemented production email auth system using Resend: email verification (4-digit code) and password reset (secure link)
- Added `EmailVerificationCode` and `PasswordResetToken` models to `prisma/schema.prisma`; applied via `prisma migrate dev` + `prisma generate`
- Created `src/lib/auth-tokens.ts` (code/token generation, SHA-256 hashing) and `src/lib/email.ts` (Resend client + templates)
- Signup flow (`src/actions/register.ts`) now creates user with `emailVerified = null`, generates/hashes a 4-digit code, emails it, and redirects to `/verify-email` instead of auto sign-in
- Added `POST /api/auth/verify-email-code` and `POST /api/auth/resend-verification-code` (with 60s per-email rate limiting) routes
- Added `POST /api/auth/password-reset/request` and `/confirm` routes; `/forgot-password` and `/reset-password` pages built
- Credentials provider in `src/auth.ts` blocks sign-in until `emailVerified` is set; Google OAuth bypasses verification
- Password reset confirm invalidates all other active `PasswordResetToken` records for the user after a successful reset
- All flows pass `npm run build`
- Passed audit and user review

## 2026-06-24 17:06

- Completed signup, onboarding, and trial subscription foundation
- `prisma/schema.prisma`: added `User.onboardingCompleted`, updated `SubscriptionTier` (`FREE_TRIAL`, `MONTHLY`, `LIFETIME`, `ADMIN`, `CANCELED`), added `Subscription.trialStartedAt`/`trialEndsAt`; applied via `prisma migrate dev` + `prisma generate`
- Built `/sign-up` (email + password) creating a `User` with a `FREE_TRIAL` `Subscription` (3-day trial) and redirecting to `/getting-started`
- Built `/getting-started` with profile, plan/trial pricing, and children steps; sets `onboardingCompleted = true` and creates `CHILD` users linked via `ParentStudent`
- Added Stripe test-mode foundation: `src/lib/stripe.ts`, `src/actions/checkout.ts`, `src/app/api/webhooks/stripe/route.ts`, documented in `docs/stripe-setup.md`; local `Subscription` is the source of truth for access, not live Stripe calls
- Added `src/proxy.ts` (Next.js 16 proxy convention) to route by `onboardingCompleted`; sign-in now defaults to `/dashboard` so the proxy can redirect unboarded users to `/getting-started`
- Fixed audit findings: sign-in redirect default, removed unapproved `playwright` dependency, allowed Google/credentials account linking by email, guarded Stripe webhook against deleted users
- Passed feature audit (tsc + eslint clean) and user review

## 2026-06-23 13:15

- Added `SubscriptionTier` enum (`STANDARD`, `ADMIN`, `CANCELED`) and `Subscription` model to `prisma/schema.prisma`
- `Subscription` is one-to-one with `User` (`onDelete: Cascade`); `tier` nullable with no default; Stripe fields (`stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeStatus`, `currentPeriodEnd`, `cancelAtPeriodEnd`) added for future billing sync
- Added `subscription Subscription?` relation field to `User`
- Generated and applied migration `20260623125933_add_subscription_model` via `prisma migrate dev`; ran `prisma generate`
- Verified `prisma migrate status` is in sync and generated client includes new types
- Schema-only change — Stripe webhook/checkout logic intentionally out of scope
- Passed audit and user review

## 2026-06-23 00:00

- Implemented custom NextAuth sign-in page at `src/app/(auth)/sign-in/page.tsx`
- Added `pages: { signIn: "/sign-in" }` to NextAuth config in `src/auth.ts`
- Google sign-in button with disabled/"Signing in..." loading state; existing credentials form retained
- Removed leftover hardcoded `/api/auth/signin` redirect in `src/app/playground/restrict/page.tsx`, now points to `/sign-in`
- Passed audit and fixes for hardcoded signin reference and Google button loading state; typecheck and lint clean

## 2026-04-19 18:30

- Built `CTASection` block component in `src/components/blocks/CTASection.tsx`
- Dark gradient card with cyan (top-right) and lime (bottom-left) radial glow decorations; scroll-reveal via `IntersectionObserver`
- Single "Get Started For Free!" primary `Button` with `Rocket` icon; "Schedule a Demo" button intentionally excluded per spec
- Added `--color-navy-medium`, `--color-cta-glow-cyan`, `--color-cta-glow-lime` theme tokens to `globals.css`
- Replaced all hardcoded hex/rgba values with CSS variable references; `boxShadow` replaced with `shadow-(--shadow-2xl)` token
- Integrated into `src/app/page.tsx` as the last section
- Created `docs/components/CTASection.md`
- Passed audit (hardcoded colors, inline text style, missing rocket icon all fixed) and user review

## 2026-04-19 17:30

- Built `TestimonialsSection` block component in `src/components/blocks/TestimonialsSection.tsx`
- Uses `Eyebrow` (with `Heart` icon, indigo accent) and `TestimonialCard` — no new components created
- 6 testimonials in a responsive 1→2→3 column grid; scroll-reveal via `IntersectionObserver` with staggered delays computed from index
- All avatar images use `/sara.jpeg` from public folder
- Section id `testimonials` matches landing page nav anchor
- Integrated into `src/app/page.tsx` below `WordGeneratorSection`
- Created `docs/components/TestimonialsSection.md`
- Passed audit (doc image path corrected, delay moved out of data type) and user review

## 2026-04-19 16:30

- Built `WordGeneratorSection` block component in `src/components/blocks/WordGeneratorSection.tsx`
- Three `FeatureCheckCard` instances: Recommended Words by Grade Level (dark), AI-Generated Words by Topic (light), Words from URLs or PDF Uploads (dark)
- Scroll-reveal animation via `IntersectionObserver` with staggered delays (0s, 0.1s, 0.2s) using existing `reveal-item`/`reveal-visible` CSS classes
- Section header uses `Eyebrow` with `Wand2` icon, `h2` title, and supporting description paragraph
- Fixed `FeatureCheckCard`: added `h-full` to card wrapper and `flex-1` to description paragraph for equal-height cards in grid rows
- Integrated into `src/app/page.tsx` below `HowItWorksSection`
- Created `docs/components/WordGeneratorSection.md`
- Passed audit and user review

## 2026-04-19 15:30

- Built `FeatureCheckCard` block component in `src/components/blocks/FeatureCheckCard.tsx`
- Props: `icon`, `iconBackgroundColor`, `title`, `children`, `checkItems` (required); `backgroundColor`, `fontColor`, `checkboxColor` (optional)
- Icon → Title → Description → Check list structure matching the white middle card from the Word Generator section of the landing page
- Dynamic theming via CSS custom properties (`--fcc-bg`, `--fcc-font`, `--fcc-icon-bg`, `--fcc-check`) set via inline style; `fontColor` applied to title, description (opacity-75), and check items
- `iconBackgroundColor` accepts full CSS values (e.g. `color-mix()`); color/font props accept token names without `--`
- Added playground examples at `/playground`: default white, indigo grade-level variant, dark card variant
- Created `docs/components/FeatureCheckCard.md`
- Passed audit (description text not respecting fontColor, hardcoded rgba, key={item} collision risk — all fixed) and user review

## 2026-04-19 14:00

- Built `TestimonialCard` block component in `src/components/blocks/TestimonialCard.tsx`
- Props: `children`, `name`, `title`, `imageUrl` (required); `backgroundColor`, `fontColor` (optional, accept CSS variable names)
- Always renders 5 Lucide stars and a left-side opening quote mark — neither is configurable
- Dynamic theming via CSS custom properties (`--card-bg`, `--card-font`) set via inline style on wrapper; all child elements use Tailwind classes
- All values use existing theme tokens: `shadow-lg`, `backdrop-blur-(--blur-glass)`, `text-label`, `text-base`, `text-2xl`, `text-sm`, `leading-relaxed`
- Title uses `text-(--card-font)/60` so it respects `fontColor` on dark backgrounds
- Added playground examples at `/playground`: default, dark background, light background
- Created `docs/components/TestimonialCard.md`
- Passed audit (arbitrary values, hardcoded shadows, inline styles, title contrast all fixed) and user review

## 2026-04-19 11:30

- Built `HowItWorksSection` block component in `src/components/blocks/HowItWorksSection.tsx`
- Two-column desktop layout: `ExampleBlock` (Student Progress card) on left spanning all rows; Eyebrow, heading, description, `CheckBadge` list on right
- Mobile order: Eyebrow → Heading → ExampleBlock → Description → CheckBadges (matching Hero responsive pattern via CSS grid `col-start`/`row-start`)
- Progress bar animations via `progressFill` keyframe added to `globals.css`; `ExampleBlock` uses existing `bob` animation
- All 6 CheckBadge items rendered: Never too easy, Never too hard, Spaced reviews, Mastery-based, Works offline, Grade-aligned
- Replaced hardcoded `rgba` values with Tailwind opacity utilities (`bg-white/10`, `bg-white/5`) matching Hero pattern
- Integrated into `src/app/page.tsx` below `FeatureSection`
- Created `docs/components/HowItWorksSection.md`
- Passed audit (hardcoded colors fixed, docs added) and user review

## 2026-04-19 10:00

- Built `CheckBadge` UI component in `src/components/ui/CheckBadge.tsx`
- Pill-style badge with a `lucide-react` check icon, label, and three optional color props: `backgroundColor`, `fontColor`, `checkboxColor`
- Props accept CSS variable names as strings; component wraps them in `var()` internally
- Defaults: white background, `--color-text-primary` text, `--color-primary-cyan` check icon
- Border uses `--color-border-muted`; shadow uses `--shadow-sm` — no hardcoded color values
- Added playground examples at `/playground`: default, custom backgrounds, custom checkbox colors
- Created `docs/components/CheckBadge.md`
- Passed audit (4 findings fixed: missing docs, hardcoded shadow, border token, heading inconsistency) and user review

## 2026-04-18 30:00

- Built `FeatureSection` block component in `src/components/blocks/FeatureSection.tsx`
- Composes 6 `FeatureCard` instances in a responsive 1→2→3 column grid
- Uses `Eyebrow` for section label; feature data defined in a clean array mapped to cards
- Scroll-reveal animation via `IntersectionObserver` toggling `.reveal-item` / `.reveal-visible` CSS classes with staggered `transitionDelay` (0s → 0.5s)
- Added `--color-icon-bg-pink`, `--color-icon-bg-amber`, `--color-icon-bg-teal-green` theme tokens to `globals.css`
- Added `h-full` to `FeatureCard` so cards stretch to equal height within grid rows
- Integrated into `src/app/page.tsx` below `TrustSection`
- Created `docs/components/FeatureSection.md`
- Passed audit (4 findings fixed: unused keyframe, iconColor renamed, stable keys, doc corrected) and user review

## 2026-04-18 29:00

- Built reusable `FeatureCard` block component in `src/components/blocks/FeatureCard.tsx`
- Props: `icon`, `iconBgColor`, `title`, `borderColor`, `children`
- Hover lift and glow effects driven entirely by CSS custom properties + Tailwind — no `"use client"` or JS event handlers
- Added playground examples at `/playground` with 6 cards using all accent color tokens
- Created `docs/components/FeatureCard.md`
- Passed audit (inline styles and missing docs fixed) and user review

## 2026-04-18 28:00

- Built `TrustSection` block component in `src/components/blocks/TrustSection.tsx`
- Renders "Trusted by schools and educators" strip with three `TrustSymbol` pill cards
- Trust items: Nixa Public Schools, Ozark R-VI Schools, EdTech Horizon Award
- Added `--color-icon-bg-teal/indigo/lime` theme tokens to `globals.css` — no hardcoded rgba values
- Section placed in `src/app/page.tsx` below `Hero`
- Created `docs/components/TrustSection.md`
- Passed audit (hardcoded color finding fixed) and user review

## 2026-04-18 27:00

- Refactored `TrustSymbol` from a full section component to a single pill component
- Removed `label`, `backgroundColor`, and `items[]` props — component now accepts `iconOrImage`, `iconBgColor`, `title`, `subtitle` directly
- Removed internal `TrustVisual` sub-component; layout is now flat and single-responsibility
- Callers compose multiple pills using a flex container — no layout imposed by the component
- Updated playground to show pills composed in a `flex-wrap` row
- Updated `docs/components/TrustSymbol.md` to reflect new API
- Passed audit and user review

## 2026-04-18 26:00

- Built `TrustSymbol` block component in `src/components/blocks/TrustSymbol.tsx`
- Renders a label/headline above a flex row of pill-shaped trust items
- Each item shows a circular icon/image visual, bold title, and muted subtitle
- `iconOrImage` accepts any `ReactNode` — icon or `<Image />` rendered as-is, no type detection needed
- `backgroundColor` prop defaults to `var(--color-surface-soft)`; configurable per instance
- Hover lift reuses `hover:-translate-y-0.5` and `hover:shadow-(--shadow-lg)` matching Button pattern
- All colors use theme tokens; `iconBgColor` uses `color-mix()` with theme vars in playground examples
- Added playground examples: icon-only, image-only, mixed, multiple background variations, realistic content
- Created `docs/components/TrustSymbol.md`
- Passed audit (all findings fixed) and user review

## 2026-04-18 25:00

- Built `Hero` block component in `src/components/blocks/Hero.tsx`
- Single CSS grid layout — no left/right wrapper divs; each element is its own grid item
- JSX order: Eyebrow → Heading → ExampleBlock → Description → CTA buttons
- Desktop: 2-column grid (`1.1fr 0.9fr`); ExampleBlock spans all 4 rows in column 2
- Mobile: 1-column auto-flow; ExampleBlock stays visible between heading and description (never hidden)
- Hero fills viewport above the fold on desktop using `min-h-[calc(100dvh-var(--header-height))]` with `--header-height: 5rem` token
- Added theme tokens: `--color-accent-orange`, `--shadow-glow-cyan`, `--header-height`
- Added `@keyframes bob` floating animation in `globals.css`
- Installed `lucide-react` for icons (approved by user)
- Created `docs/components/Hero.md`
- Placed in `src/app/page.tsx`
- Passed audit (all 7 findings fixed) and user review

## 2026-04-18 24:00

- Built reusable `ExampleBlock` component in `src/components/blocks/ExampleBlock.tsx`
- Based on `.quiz-card` design from landing page — matches background, radius, padding, and shadow exactly
- Props: `label` (required), `status` (optional, conditional badge), `statusColor` (optional, overrides lime default)
- Badge background injected via typed CSS custom property (`BadgeStyle` interface extending `React.CSSProperties`)
- Added component-level typography and spacing tokens to `globals.css` (`--font-size-label`, `--font-size-badge`, `--tracking-label`, `--tracking-badge`, `--spacing-card-pad`, `--spacing-badge-x/y`)
- Added playground examples at `/playground` for all three prop combinations
- Added component docs at `docs/components/ExampleBlock.md`
- Passed audit and user review

## 2026-04-18 23:30

- Built reusable `Eyebrow` component in `src/components/ui/Eyebrow.tsx`
- Replaces `.hero-badge` and `.section-label` from landing page design
- Props: `bgColor` and `textColor` accept CSS variable names; defaults to primary-cyan bg and text-primary text
- Color applied via inline CSS custom properties — Tailwind v4 resolves opacity at runtime without dynamic class issues
- No `className` prop — all styling controlled via props per spec
- Created `src/app/playground/page.tsx` at `/playground` with all four landing page eyebrows and color variant examples
- Added component docs at `docs/components/Eyebrow.md`
- TypeScript strict check passed with no errors
- Passed user review

## 2026-04-18 22:15

- Swapped mobile header layout: hamburger moved to left, logo centered using 3-col grid (`grid-cols-[1fr_auto_1fr]`)
- Desktop layout unchanged (logo left, nav center, CTA right)
- Removed portal/mounted-state pattern from `HeaderNav.tsx` — drawer inlined directly, simplifying SSR handling
- Restored `md:hidden` guards on backdrop and drawer to prevent desktop rendering
- Passed audit and user review

## 2026-04-18 21:30

- Refined header responsiveness for logo and nav items
- Logo scales fluidly using `clamp(28px, 3.9vw, 56px)` — full size on desktop, shrinks smoothly on smaller viewports
- CTA button is 15% smaller below `lg` breakpoint using fixed Tailwind responsive classes
- Nav item spacing (gap + horizontal padding) scales fluidly with `clamp()` starting at large viewports
- All changes in `Header.tsx` and `HeaderNav.tsx`

## 2026-04-18 20:00

- Built site header with logo, desktop nav, CTA button, and mobile slide-out drawer
- Created `Header.tsx`, `HeaderNav.tsx` in `src/components/layout/header/`
- Created reusable `Button.tsx` in `src/components/ui/` with `cta`, `primary`, `secondary` variants; polymorphic (renders `<a>` or `<button>` based on `href`)
- Added `Button` documentation to `docs/components/Button.md`
- Wired `<Header />` into `layout.tsx`
- Fixed audit findings: Button type safety, layout indentation, removed structural comments, logo LCP and aspect ratio warnings
- Passed audit and user review; merged to main
- Note: responsiveness flagged for follow-up fix

## 2026-04-17 16:30

- Expanded global theme in `globals.css` with radius, shadow, surface/glass, layout, effects, and transition tokens
- Set background gradient on `body` in CSS; removed duplicate gradient class from `page.tsx`
- Updated `page.tsx` to use direct Tailwind v4 token utilities instead of `[var(--color-...)]` arbitrary syntax
- Passed feature audit and user review; merged to main

## 2026-04-17 15:00

- Added Plus Jakarta Sans (body) and Baloo 2 (display) via `next/font/google` in `layout.tsx`
- Assigned `--font-jakarta` and `--font-baloo` CSS variables, applied to `<html>` className
- Mapped `--font-sans` and `--font-display` theme tokens in `globals.css` using `@theme`
- Applied `font-sans` to `<body>` for global font inheritance; `font-display` on `<h1>` test
- Added `display: "swap"` to both font configs per audit finding
- Verified visually on homepage; passed feature audit

## 2026-04-17 14:00

- Completed Theme System Setup using Tailwind v4 `@theme` tokens in `globals.css`
- Defined all color tokens (main, accent, utility) as CSS custom properties under `@theme`
- Updated `layout.tsx` and `page.tsx` to use `var(--color-...)` tokens — no hardcoded hex values remain
- No default Tailwind colors used anywhere in the codebase
- Passed codex audit with no findings
- Foundational theme system in place for all future features

## 2026-07-17 16:08

- Completed Stage 2A runtime and toolchain alignment with Next.js and `eslint-config-next` 16.2.9, Node 24.14.1, and ESM package behavior
- Added the approved `server-only`, `tsx`, and `playwright-core` dependencies and excluded `references/**` from host TypeScript and ESLint checks
- Verified the development server reached ready state and returned HTTP 200; no existing host test command was present

## 2026-07-22 14:46

- Diagnosed the Vocabulary module TTS playback regression flagged in audit; no fix implemented (diagnosis only, as instructed)
- Confirmed via read-only review that the CSS-var-to-Tailwind-theme commits (`6a85d2a`, `7e76318`) did not cause the regression — all diffs in TTS-adjacent files (`DefinitionDisplay.tsx`, `AnswerRecapWindow.tsx`, `SpellingWindow.tsx`, `MultipleChoiceWindow.tsx`, `UI/Button.tsx`) are class-name-equivalent with no changed event handlers, props, or interactive CSS
- Reproduced the failure with temporary instrumentation added to `SpeechPlaybackController.ts` and `src/app/le-playground/page.tsx` (both reverted afterward, branch left clean): confirmed `/api/tts` returns a valid 200 `audio/mpeg` blob every time, and the exact failing step is `audio.play()` — the `<audio>` element never advances past `readyState: 0` / `networkState: 2`, isolated down to the browser's media pipeline itself (reproduced with a bare `new Audio()` call, no app code involved)
- Noted the test browser tab reported `document.hidden: true` during reproduction, a likely confound of the automated browser environment; recommended re-running the same manual-click test in a normal foreground tab to confirm whether the same stall occurs for real users
- Also flagged (unfixed): every failure path in `SpeechPlaybackController.ts` uses an empty/silent `catch`, so this class of failure produces no console error or user-visible feedback

## 2026-07-22 17:34

- Completed CSS variable cleanup phase 3 on `var-cleanup-phase-3`: removed redundant `var(--color-*)` shadow-color arguments from `box-shadow` arbitrary values (e.g. `shadow-[0_16px_56px_var(--color-navy)]` → `shadow-[0_16px_56px]`) across host and Learning Engine components, since the adjacent `shadow-<color>/<alpha>` utility already supplies the shadow color
- Converted remaining `color-mix(in srgb, var(--color-*) ...)` inline gradient `style` props to Tailwind v4 `bg-linear-*/srgb` and `bg-radial/srgb` utilities with color/opacity classes (`CTASection.tsx`, `DefinitionFunFact.tsx`, `VocabularyStartupVisual.tsx`), eliminating the last inline `style` gradients tied to CSS vars
- Files touched: `CTASection.tsx`, `Header.tsx`, `HeaderNav.tsx`, `components/ui/Button.tsx`, `learning-engine-components/Blocks/Header.tsx`, `UI/Button.tsx`, all `LearningWindows/*` window components, `VocabularyStartupContent.tsx`, `VocabularyStartupVisual.tsx`

## 2026-07-22 18:58

- Unified the Host and Learning Engine theme files on `feature/unify-global-theme`: deleted `src/app/(app)/(learning)/globals.css` and merged its tokens into the single `src/app/globals.css`
- Defined a "final theme" of 15 base colors under `@theme` (`--color-primary`, `--color-secondary`, `--color-heading`, `--color-text`, `--color-muted`, `--color-background`, `--color-white`, `--color-danger`, plus accents) and a shared opacity scale, as the long-term target for both Host and Learning Engine components
- Kept old Host and Learning Engine token names as "temporary legacy" aliases pointing at the new final-theme variables (or their original values where no equivalent existed yet), so no component classes broke during the merge
- Reconciled duplicate surface tokens: `--surface-strong` unified at 82%, `--surface-soft` unified at 72% (Host's unused 45% value dropped)
- `src/app/(app)/(learning)/layout.tsx`: removed the now-deleted `./globals.css` import and added a `learning-shell` wrapper class to preserve the Learning Engine's solid page background independent of the Host's gradient body background
- Left the non-color theme sections (typography, radius, shadows, layout, effects, motion) untouched, flagged for a separate trim pass after the color migration completes

## 2026-07-22 20:15

- Completed theme migration batch 1 on `feature/host-theme-batch-1`: expanded `src/lib/theme-colors.ts` `COLOR_TOKENS`/`COLOR_CLASS_MAP` with the 15-token final BrainGenius theme (`primary`, `secondary`, `primary-strong`, `secondary-strong`, `heading`, `text`, `muted`, `background`, `surface`, `danger`, `feature`, `highlight`, `warning`, `success`, `energy`), keeping old Host/Learning Engine token names (`cyan`, `lime`, `indigo`, `pink`, `amber`, `teal`, `teal-green`, `white`, `dark`, `bg-top`, `text-primary`) as migration-only aliases mapped onto the new tokens
- Converted first batch of host components off legacy tokens/raw CSS vars onto the final theme: `FeatureCard`, `TrustSymbol`, `CheckBadge`, `Eyebrow`, `Modal`, `PasswordInput`, `Button`, `Header`, `HeaderNav`, `layout.tsx`
- Fixed `src/app/globals.css` global theme variable definitions to align with the unified token set (`613b301`)
- Migration-only aliases intentionally left in place until remaining callers across the codebase are converted in later batches

## 2026-07-22 21:40

- Completed theme migration batch 4 on `feature/host-theme-batch-4`, the final conversion batch: migrated the last remaining caller, `src/app/playground/page.tsx`, off legacy alias tokens and raw `text-(--color-*)` / `bg-(--color-*)` arbitrary values onto the final `ColorToken` set (`primary`, `secondary`, `feature`, `highlight`, `warning`, `success`, `heading`, `surface`, `background`, `muted`)
- Since usage of the migration-only aliases reached zero, removed them entirely: deleted all alias entries (`cyan`, `lime`, `indigo`, `pink`, `amber`, `teal`, `teal-green`, `white`, `dark`, `bg-top`, `text-primary`) from `COLOR_TOKENS` and every `COLOR_CLASS_MAP` group in `src/lib/theme-colors.ts`
- Removed the corresponding `TEMPORARY LEGACY — HOST COLOR NAMES` block and related `--color-*` passthroughs from `src/app/globals.css`, and updated the `body` background gradient to use `--color-background`/`--color-surface` directly instead of the deleted `--color-bg-top`/`--color-bg-bottom`
- This closes out the Host/Learning Engine theme unification effort started in `feature/unify-global-theme` — all components now consume the single final 15-token theme with no legacy aliases remaining

## 2026-07-23 09:02

- Completed Learning Engine theme migration batch 1 on `feature/learning-theme-batch-1`: converted the first batch of Learning Engine components off legacy tokens/raw CSS vars onto the final `ColorToken` set — `Header`, `Sidebar`, `StartupWindow`, `UI/Button`, `VocabularyStartupContent`, `VocabularyStartupVisual`
- Replaced legacy names (`navy`, `lime`, `cyan`, `white`, `hairline`, `muted-light`, `track`, `surface-strong`/`surface-soft`, `lime-ink`/`lime-strong`, `cyan-ink`, `tint-lime`/`tint-cyan`, `border-lime`) with final theme tokens and opacity variants (`heading`, `secondary`/`secondary-strong`, `primary`/`primary-strong`, `surface`, `muted`) e.g. `bg-navy` → `bg-heading`, `text-lime-ink` → `text-secondary-strong`, `border-hairline` → `border-heading/7`
- Continues the Host/Learning Engine theme unification effort, applying the same final-token conversion already completed for Host components in `feature/host-theme-batch-1` through `feature/host-theme-batch-4`

## 2026-07-23 21:12

- Completed Learning Engine theme migration batch 2 on `feature/learning-theme-batch-2`: converted the LearningWindows component set off legacy tokens/raw CSS vars onto the final `ColorToken` set — `AnswerRecapWindow`, `DefinitionDisplay`, `DefinitionFunFact`, `LearningErrorWindow`, `LessonCompleteWindow`, `MultipleChoiceWindow`, `SpellingWindow`, `WordSearchWindow`
- Replaced legacy names (`navy`, `cyan`/`cyan-ink`, `lime`/`lime-ink`/`lime-strong`, `purple`, `red`/`red-ink`/`red-strong`, `ink`, `white`, `border-neutral`/`border-neutral-faded`, `tint-neutral-faded`, `muted-light`) with final theme tokens (`heading`, `primary`/`primary-strong`, `secondary`/`secondary-strong`, `feature`, `danger`, `text`, `surface`, `muted`) and opacity variants, e.g. `text-navy` → `text-heading`, `bg-cyan/13` → `bg-primary/13`, `text-red-strong` → `text-danger`, `border-border-neutral` → `border-heading/13`
- Continues the Host/Learning Engine theme unification effort, following `feature/learning-theme-batch-1`

## 2026-07-23 22:15

- Completed shared opacity variable remediation on `feature/shared-opacity-variable-remediation`: replaced every hardcoded numeric opacity modifier and `color-mix()` percentage tied to a theme color (e.g. `text-heading/48`, `bg-secondary/13`, `shadow-primary/34`, `opacity-74`, `color-mix(in_srgb,var(--color-primary)_20%,transparent)`) with a reference to the shared `--alpha-*` CSS custom properties (`--alpha-hairline`, `--alpha-subtle`, `--alpha-soft`, `--alpha-medium`, `--alpha-surface-soft`, `--alpha-surface`, `--alpha-surface-strong`), e.g. `text-heading/48` → `text-heading/(--alpha-surface-soft)`
- Switched the `--alpha-*` definitions in `src/app/globals.css` from unitless decimals (`0.13`) to percentages (`13%`) so they resolve correctly as Tailwind v4 opacity-modifier and `opacity-*` values
- Updated `src/lib/theme-colors.ts` `COLOR_CLASS_MAP` (`textMuted`, `iconBg`, `border`, `tintBg`, `tintBorder` groups) to emit the `/(--alpha-*)` syntax instead of raw percentages
- Converted every remaining caller across auth pages, onboarding steps, layout/header components, UI components (`Button`, `CheckBadge`, `Modal`), landing page blocks, and all Learning Engine components/windows/modules — 41 files total, no functional or visual change, opacity values are unchanged, only their source of truth is now centralized
- This removes the last hardcoded opacity duplication left over from the Host/Learning Engine theme unification effort

## 2026-07-23 22:40

- Completed semantic contrast batch 4 on `feature/theme-semantic-contrast-batch-4`: added job-specific semantic color aliases (`--color-link`, `--color-success-text`, `--color-focus`, `--color-on-dark`) in `src/app/globals.css` under a new `@theme inline` block, mapped onto the existing 15 base theme colors, so call sites express intent (e.g. `text-link`, `focus:border-focus`) instead of reusing raw palette tokens
- Fixed a WCAG contrast issue in `theme-colors.ts`'s `textMuted` map: `heading`/`text` variants now resolve to solid `text-muted` instead of a translucent `text-heading/(--alpha-surface-soft)` / `text-text/(--alpha-surface-soft)`, since the faded form fell below the 4.5:1 minimum on light surfaces; the `surface` variant (used on dark cards) is unchanged since translucent white stays readable there
- Added visible focus-ring styling (`focus-visible:ring-2 focus-visible:ring-focus/(--alpha-medium)`) alongside `focus:border-focus` across all auth pages (sign-in, sign-up, forgot-password, reset-password, verify-email)
- Converted remaining `text-(--font-size-badge)`/`text-(--font-size-label)` arbitrary-value references to the new `text-badge`/`text-label` Tailwind utilities (enabled by renaming the `--font-size-*` theme keys to `--text-*` in `globals.css`) across `Hero`, `ExampleBlock`, `HowItWorksSection`, `ChildrenStep`, and the Learning Engine window components
- Applied the corrected `textMuted`/`text-link`/`text-badge` tokens across onboarding steps (`ChildrenStep`, `ProfileStep`) and Learning Engine windows (`AnswerRecapWindow`, `DefinitionDisplay`, `MultipleChoiceWindow`, `SpellingWindow`)
