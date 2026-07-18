# Tech Stack

Use `package.json` as the source of truth for installed packages and versions.

## Core Stack

- Next.js with the App Router
- React
- TypeScript / TSX
- Tailwind CSS
- ESLint
- npm with `package-lock.json`
- Node.js 24, as pinned by `.nvmrc` and `package.json`

## Project Architecture

- The shared `LearningEngine` loads learning modules and manages screens, actions, shared state, errors, and text-to-speech.
- Learning modules contain subject-specific logic and return `ScreenRequest` objects.
- Learning Windows are learner-facing React components selected through the Learning Engine's window registry.
- Dynamic learning routes use `src/app/learning/[...learning]/page.tsx`.
- Server-only behavior is implemented through Next.js route handlers.

## External Services

- Google Cloud Text-to-Speech
- Lemonfox Text-to-Speech

Both TTS providers are accessed through the internal `POST /api/tts` route using native `fetch`. Provider credentials and answer-validation data must remain server-only.

## Tests and Checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:multiple-choice
npm run test:tts
npm run build
```

Run the checks relevant to the change.

## Rules

- Do not assume a package is installed unless it appears in `package.json`.
- Do not add or upgrade dependencies unless the task requires it.
- Follow the existing architecture before introducing another framework, state system, validation library, ORM, or authentication system.
- Keep secrets, answer keys, and provider integrations on the server.
