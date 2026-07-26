# Local Development

## Prerequisites

- Node `24.14.1` (`.nvmrc`; package range is `>=24.14.1 <25`).
- npm and a PostgreSQL database for account-backed flows.
- Service-specific test credentials only for OAuth, email, Stripe, or real TTS work.

## Setup

```bash
npm install
npx prisma generate
```

Create an untracked local environment file with the variable names required by the services you will exercise. See [Environment Variables](../reference/environment-variables.md). Never commit values.

For an approved schema change:

```bash
npx prisma migrate status
npx prisma migrate dev --name <migration-name>
npx prisma generate
```

Do not use `prisma db push` as a migration replacement. Review generated SQL before applying it beyond local development. Production uses `npx prisma migrate deploy`; the repository has no deployment wrapper.

## Run and verify

```bash
npm run dev
npx tsc --noEmit
npm run lint
npm run build
```

`npm run dev` uses `next dev --webpack`. `npm run start` serves an existing production build. Direct test commands and prerequisites are in [Testing](../reference/testing.md).

Useful routes:

- `/` — public site;
- `/playground` — marketing component gallery;
- `/le-playground` — Learning Window gallery;
- `/learning/vocabulary/word_list_id` — current Vocabulary fixture;
- `/sign-up`, `/sign-in`, `/getting-started` — account/funnel flow.

The production client-bundle security scan requires a successful `.next` build. Browser tests require Google Chrome at the macOS path used in the test source.
