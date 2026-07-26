# Brain Genius Documentation

This directory describes the application implemented in the current repository. Source and tests outrank prose when behavior changes.

## How documentation is organized

- Active docs below describe current architecture, contracts, services, operations, and maintained source.
- Engineering rules under [`.claude/rules/`](../.claude/rules/) define ownership and change constraints; they are not duplicated here.
- [`context/project-summary.md`](../context/project-summary.md) provides short orientation, while [`context/history.md`](../context/history.md) records completed work and is not a current API reference.
- [`archive/README.md`](archive/README.md) explains historical material. Archive content is evidence about earlier states, not active guidance.

## Architecture

- [System Overview](architecture/system-overview.md)
- [Application and Route Map](architecture/application-and-route-map.md)
- [Learning Engine and Module Boundaries](architecture/learning-engine-and-module-boundaries.md)
- [Security and Server Boundaries](architecture/security-and-server-boundaries.md)

## Components

### Marketing blocks

- [CTASection](components/blocks/CTASection.md)
- [ExampleBlock](components/blocks/ExampleBlock.md)
- [FeatureCard](components/blocks/FeatureCard.md)
- [FeatureCheckCard](components/blocks/FeatureCheckCard.md)
- [FeatureSection](components/blocks/FeatureSection.md)
- [Hero](components/blocks/Hero.md)
- [HowItWorksSection](components/blocks/HowItWorksSection.md)
- [TestimonialCard](components/blocks/TestimonialCard.md)
- [TestimonialsSection](components/blocks/TestimonialsSection.md)
- [TrustSection](components/blocks/TrustSection.md)
- [TrustSymbol](components/blocks/TrustSymbol.md)
- [WordGeneratorSection](components/blocks/WordGeneratorSection.md)

### Website layout

- [Header](components/layout/header/Header.md)
- [HeaderNav](components/layout/header/HeaderNav.md)

### Learning Engine

- [LearningWindowShell](components/learning-engine/LearningWindowShell.md)
- [ScreenRenderer](components/learning-engine/ScreenRenderer.md)
- [LearningHeader](components/learning-engine/layout/LearningHeader.md)
- [LearningSidebar](components/learning-engine/layout/LearningSidebar.md)
- [AnswerRecapWindow](components/learning-engine/windows/AnswerRecapWindow.md)
- [DefinitionDisplay](components/learning-engine/windows/DefinitionDisplay.md)
- [DefinitionFunFact](components/learning-engine/windows/DefinitionFunFact.md)
- [LearningErrorWindow](components/learning-engine/windows/LearningErrorWindow.md)
- [LessonCompleteWindow](components/learning-engine/windows/LessonCompleteWindow.md)
- [MultipleChoiceWindow](components/learning-engine/windows/MultipleChoiceWindow.md)
- [SpellingWindow](components/learning-engine/windows/SpellingWindow.md)
- [StartupWindow](components/learning-engine/windows/StartupWindow.md)
- [WordSearchWindow](components/learning-engine/windows/WordSearchWindow.md)

### Onboarding

- [ChildrenStep](components/onboarding/ChildrenStep.md)
- [OnboardingShell](components/onboarding/OnboardingShell.md)
- [PlanStep](components/onboarding/PlanStep.md)
- [ProfileStep](components/onboarding/ProfileStep.md)
- [WelcomeVideoStep](components/onboarding/WelcomeVideoStep.md)

### Shared UI

- [Button](components/ui/Button.md)
- [CheckBadge](components/ui/CheckBadge.md)
- [Eyebrow](components/ui/Eyebrow.md)
- [Input](components/ui/Input.md)
- [Modal](components/ui/Modal.md)
- [PasswordInput](components/ui/PasswordInput.md)

## Module

- [Vocabulary](modules/vocabulary.md)

## Services

- [Authentication and Accounts](services/authentication-and-accounts.md)
- [Billing and Subscriptions](services/billing-and-subscriptions.md)
- [Email Verification and Password Reset](services/email-verification-and-password-reset.md)
- [Text-to-Speech](services/text-to-speech.md)

## Reference

- [API Routes](reference/api-routes.md)
- [Server Actions](reference/server-actions.md)
- [Database Schema](reference/database-schema.md)
- [Environment Variables](reference/environment-variables.md)
- [Theme and Styling](reference/theme-and-styling.md)
- [Testing](reference/testing.md)

## Operations

- [Local Development](operations/local-development.md)
- [Stripe](operations/stripe.md)

## Maintained source coverage

| Source area | Active documentation |
| --- | --- |
| `src/app/layout.tsx`, `src/app/auth/`, `src/app/globals.css` | System Overview; Authentication and Accounts; Theme and Styling |
| `src/app/(website)/` | Application and Route Map; marketing/layout component contracts |
| `src/app/(auth)/` | Application and Route Map; Authentication and Accounts; Email Verification and Password Reset |
| `src/app/(app)/dashboard/` | Application and Route Map |
| `src/app/(app)/(learning)/` | Application and Route Map; Learning Engine and Module Boundaries; Security and Server Boundaries |
| `src/app/playground/`, `src/app/le-playground/` | Application and Route Map; relevant component contracts; Testing |
| `src/app/api/` | API Routes plus the owning service/module docs |
| `src/actions/` | Server Actions plus Authentication and Accounts/Billing |
| `src/auth.ts`, `src/proxy.ts` | Authentication and Accounts; Application and Route Map |
| `src/components/blocks/` | One document per component under Components / Marketing blocks |
| `src/components/layout/` | One document per component under Components / Website layout |
| `src/components/learning-engine/` | One document per component under Components / Learning Engine; Learning Engine and Module Boundaries |
| `src/components/onboarding/` | One document per component under Components / Onboarding; Authentication and Accounts |
| `src/components/ui/` | One document per component under Components / Shared UI; Theme and Styling |
| `src/learning-modules/vocabulary/` | Vocabulary; Security and Server Boundaries; API Routes; Text-to-Speech |
| `src/lib/learning-engine/`, `src/types/learning.ts` | Learning Engine and Module Boundaries; Text-to-Speech; Learning Window contracts |
| `src/lib/auth-tokens.ts`, `db.ts`, `email.ts`, `onboarding-funnel.ts`, `stripe.ts`, `subscription.ts` | Owning service docs; Database Schema; Environment Variables |
| `src/lib/theme-colors.ts`, `theme-colors.type-check.ts` | Theme and Styling |
| `src/lib/emojis.ts` | Consuming component contracts; production emoji ownership is defined by engineering rules |
| `src/lib/random/normalizedRandom.ts` | Vocabulary |
| `src/generated/` | Narrowly excluded: Prisma-generated code; source schema is documented instead |

## Updating docs

Update active documentation in the same change whenever a route, component prop/action, service boundary, environment-variable contract, schema, test command, or module behavior changes. Add one component document for every new `.tsx` file under `src/components/` and remove the document when that component is removed. Keep examples executable against current imports and props, keep relative links valid, and move historical-only material to the archive rather than mixing chronology into active reference docs.
