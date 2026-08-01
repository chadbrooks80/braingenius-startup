# TO DO: Move Generic Learning Security From Vocabulary Into the Learning Engine

## Why this file exists

The immediate database feature fixes an important reliability problem: active Vocabulary lessons, capabilities, and attempts will be stored in the shared database instead of the private memory of one running copy of the web server.

That correction keeps the current architecture intact on purpose. Vocabulary will still create and manage its own lesson IDs, capability IDs, attempt IDs, expiration, replay protection, and answer-submission security.

That is acceptable as an immediate fix, but it should not be the final architecture. Reading, Math, Science, Spanish, and every other future module would otherwise have to build their own version of the same sensitive security system.

The future goal is:

> The Learning Engine handles the generic security and submission pipeline once. Each learning module handles only its subject content, grading rules, and progression.

This document explains the problem and shows what the code should look like after that future redesign has been completed.

---

## Where the code stands after the immediate database fix

Vocabulary currently owns a class located at:

```text
src/learning-modules/vocabulary/server/
VocabularyContentCapabilityStore.ts
```

Before the database fix, that class stored these records in JavaScript Maps:

```ts
private readonly lessons = new Map<string, LessonRecord>();
private readonly capabilities = new Map<string, CapabilityRecord>();
private readonly attempts = new Map<string, AttemptRecord>();
```

After the immediate database fix, those records are stored in a Vocabulary-owned database table instead. The reliability problem is fixed because every running copy of the web server can read the same records.

Conceptually, the corrected short-term flow is:

```text
Vocabulary creates lesson/capability/attempt
                    ↓
Vocabulary saves the records in PostgreSQL
                    ↓
Any running copy of the web server can continue the lesson
```

However, Vocabulary still owns all of the following generic responsibilities:

- Creating secure lesson IDs
- Creating secure capability IDs
- Creating attempt IDs
- Binding an attempt to the correct learner
- Expiring security records
- Preventing replay
- Handling duplicate submissions
- Saving protected answer snapshots
- Making multi-record updates atomic
- Handling simultaneous submissions safely
- Returning generic security failures

None of those responsibilities are unique to vocabulary words. Every graded learning module needs them.

---

## The architectural problem

Vocabulary-specific behavior and reusable security behavior are currently mixed together.

For example, these responsibilities belong to Vocabulary:

```text
Choose the next vocabulary word
Build definition choices
Know the correct spelling
Grade a definition or spelling answer
Update definition and spelling mastery
Schedule a delayed vocabulary review
Decide when to show a Word Search checkpoint
```

These responsibilities are generic and should work identically for every module:

```text
Authenticate the learner
Create an opaque session ID
Create an opaque attempt ID
Bind the attempt to the learner and module
Enforce expiration
Allow an attempt to be consumed once
Handle an exact duplicate safely
Reject an altered duplicate
Protect private grading data from the browser
Store everything in the shared database
Apply related updates in one transaction
```

The mistake is not that Vocabulary owns its grading rules. It must own those rules.

The remaining problem is that Vocabulary also owns the reusable security machinery surrounding those rules.

---

## Final ownership after the future redesign

| Learning Engine owns | Vocabulary owns |
| --- | --- |
| Secure session IDs | Vocabulary words and definitions |
| Secure capability and attempt IDs | Building definition and spelling questions |
| Learner/module/session binding | Parsing Vocabulary answer variants |
| Expiration | Determining whether the answer is correct |
| One-time consumption | Definition and spelling mastery |
| Replay and duplicate protection | Active five-word pool |
| Shared database persistence | Reviews and checkpoints |
| Transaction and concurrency safety | Selecting the next Vocabulary step |
| Generic submission transport | Producing Vocabulary screen content |
| Generic safe errors | Vocabulary-specific public feedback |

The Learning Engine must never learn what a vocabulary definition, spelling answer, math equation, or reading question means. It handles the secure envelope around the work and calls the owning module to interpret the subject-specific data.

---

## Final request flow

After the redesign, submitting an answer works like this:

```text
1. Learning Window emits a generic submit-answer action
2. Learning Engine receives the action
3. Shared submission service authenticates the learner
4. Shared database store loads the attempt
5. Engine verifies ownership, module, session, status, and expiration
6. Engine loads the registered server adapter for that module
7. Module validates and grades its own answer
8. Module updates its own progression state
9. Engine atomically saves the attempt result and next secure transition
10. Engine applies the module's returned ScreenRequest
```

The engine controls security and transport. The module controls teaching.

---

## Final file structure

The exact names may be refined when this feature is implemented, but the responsibility boundaries should look like this:

```text
src/
├── app/api/learning/
│   ├── content/route.ts
│   └── submit-answer/route.ts
│
├── lib/learning-engine/
│   ├── server/
│   │   ├── LearningRuntimeStore.ts
│   │   ├── LearningSubmissionService.ts
│   │   ├── LearningModuleServerAdapter.ts
│   │   └── LearningModuleServerRegistry.ts
│   └── actions/
│       └── createLearningEngineActionHandlers.ts
│
└── learning-modules/
    └── vocabulary/
        ├── server/
        │   └── VocabularyServerAdapter.ts
        ├── state/
        │   └── VocabularyLessonState.ts
        ├── validation/
        │   └── parseVocabularySubmitAnswerPayload.ts
        └── screens/
            └── ...Vocabulary screen builders
```

The shared engine files contain no subject names. The only Vocabulary-specific server integration is `VocabularyServerAdapter.ts`.

---

## Shared database models

Instead of a Vocabulary-only runtime-security table, the final system uses subject-neutral learning tables.

A simplified example:

```prisma
model LearningRuntimeSession {
  id           String   @id @default(uuid())
  moduleName   String
  learnerId    String
  moduleState  Json
  stateVersion Int      @default(0)
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  capabilities LearningRuntimeCapability[]
  attempts     LearningRuntimeAttempt[]

  @@index([learnerId, moduleName])
  @@index([expiresAt])
  @@map("learning_runtime_sessions")
}

model LearningRuntimeCapability {
  id              String   @id @default(uuid())
  sessionId       String
  operation       String
  modulePayload   Json
  consumedAt      DateTime?
  expiresAt       DateTime
  createdAt       DateTime @default(now())

  session LearningRuntimeSession @relation(
    fields: [sessionId],
    references: [id],
    onDelete: Cascade
  )

  @@index([sessionId, expiresAt])
  @@map("learning_runtime_capabilities")
}

model LearningRuntimeAttempt {
  id               String   @id @default(uuid())
  sessionId        String
  moduleName       String
  attemptType      String
  protectedPayload Json
  submission       Json?
  publicResult     Json?
  status           String
  answeredAt       DateTime?
  expiresAt        DateTime
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  session LearningRuntimeSession @relation(
    fields: [sessionId],
    references: [id],
    onDelete: Cascade
  )

  @@index([sessionId, status])
  @@index([expiresAt])
  @@map("learning_runtime_attempts")
}
```

These are examples, not a ready migration. The implementation feature must inspect the latest database design before choosing the final fields and migration strategy.

Important rules:

- `moduleName` identifies the registered module but does not make the engine understand that subject.
- `moduleState`, `modulePayload`, and `protectedPayload` are opaque to the engine.
- The owning module strictly validates those payloads before using them.
- Protected payloads never go to the browser.
- Generic statuses and operation names must remain subject-neutral.
- Do not add values such as `VOCABULARY_ANSWER`, `READING_ANSWER`, or `MATH_ANSWER` to shared engine enums.

---

## Shared module adapter contract

Every graded module registers a server adapter with the Learning Engine.

The shared contract could look like this:

```ts
// src/lib/learning-engine/server/LearningModuleServerAdapter.ts

export type LearningModuleGradeContext = {
  learnerId: string;
  sessionId: string;
  attemptId: string;
  moduleState: unknown;
  protectedPayload: unknown;
  rawSubmission: unknown;
};

export type LearningModuleGradeResult = {
  updatedModuleState: unknown;
  publicResult: unknown;
  nextScreen: ScreenRequest;
};

export interface LearningModuleServerAdapter {
  readonly moduleName: string;

  gradeAndAdvance(
    context: LearningModuleGradeContext
  ): Promise<LearningModuleGradeResult>;
}
```

The engine is allowed to transport `unknown` data. It is not allowed to interpret it.

The registered module must parse and validate all module-owned payloads before grading.

---

## Vocabulary adapter after the redesign

Vocabulary implements the shared adapter:

```ts
// src/learning-modules/vocabulary/server/VocabularyServerAdapter.ts

import "server-only";

import type {
  LearningModuleServerAdapter,
  LearningModuleGradeContext,
  LearningModuleGradeResult,
} from "@/lib/learning-engine/server/LearningModuleServerAdapter";

import { parseVocabularySubmitAnswerPayload } from "../validation/parseVocabularySubmitAnswerPayload";

export const vocabularyServerAdapter: LearningModuleServerAdapter = {
  moduleName: "vocabulary",

  async gradeAndAdvance(
    context: LearningModuleGradeContext
  ): Promise<LearningModuleGradeResult> {
    const submission = parseVocabularySubmitAnswerPayload(
      context.rawSubmission
    );

    const protectedAttempt = parseProtectedVocabularyAttempt(
      context.protectedPayload
    );

    const result = gradeVocabularyAnswer(
      protectedAttempt,
      submission
    );

    const vocabularyState = restoreVocabularyLessonState(
      context.moduleState
    );

    vocabularyState.recordSubmission(result);

    return {
      updatedModuleState: vocabularyState.toSnapshot(),
      publicResult: createVocabularyPublicResult(result),
      nextScreen: createVocabularyNextScreen(vocabularyState),
    };
  },
};
```

Vocabulary still performs all Vocabulary-specific work:

- It parses definition and spelling submissions.
- It knows the correct answer.
- It updates Vocabulary mastery.
- It chooses the next Vocabulary activity.
- It creates the next Vocabulary `ScreenRequest`.

It does not create security IDs, query generic attempt ownership, implement expiration, prevent replay, or coordinate simultaneous submissions.

---

## Shared adapter registry

The Learning Engine uses a subject-neutral registry:

```ts
// src/lib/learning-engine/server/LearningModuleServerRegistry.ts

import type { LearningModuleServerAdapter } from "./LearningModuleServerAdapter";

import { vocabularyServerAdapter } from "@/learning-modules/vocabulary/server/VocabularyServerAdapter";

const adapters = new Map<string, LearningModuleServerAdapter>([
  [vocabularyServerAdapter.moduleName, vocabularyServerAdapter],
]);

export function getLearningModuleServerAdapter(
  moduleName: string
): LearningModuleServerAdapter | null {
  return adapters.get(moduleName) ?? null;
}
```

Later, Reading registers its adapter without changing the generic submission service:

```ts
const adapters = new Map<string, LearningModuleServerAdapter>([
  [vocabularyServerAdapter.moduleName, vocabularyServerAdapter],
  [readingServerAdapter.moduleName, readingServerAdapter],
]);
```

The engine only loads the registered adapter. It never adds `if (moduleName === "vocabulary")` branches.

---

## Shared submission service

This is the central security pipeline that replaces the security code currently repeated inside Vocabulary:

```ts
// src/lib/learning-engine/server/LearningSubmissionService.ts

export async function submitLearningAnswer(input: {
  learnerId: string;
  attemptId: string;
  rawSubmission: unknown;
}): Promise<LearningSubmissionResponse> {
  return learningRuntimeStore.transaction(async (transaction) => {
    const attempt = await transaction.getAttempt(input.attemptId);

    if (!attempt) {
      return invalidLearningSubmission();
    }

    const session = await transaction.getSession(attempt.sessionId);

    if (
      !session ||
      session.learnerId !== input.learnerId ||
      session.moduleName !== attempt.moduleName
    ) {
      return invalidLearningSubmission();
    }

    if (attempt.expiresAt <= new Date()) {
      return invalidLearningSubmission();
    }

    if (attempt.status === "ANSWERED") {
      return resolveDuplicateSubmission(attempt, input.rawSubmission);
    }

    if (attempt.status !== "ACTIVE") {
      return invalidLearningSubmission();
    }

    const adapter = getLearningModuleServerAdapter(
      attempt.moduleName
    );

    if (!adapter) {
      return unavailableLearningModule();
    }

    const moduleResult = await adapter.gradeAndAdvance({
      learnerId: input.learnerId,
      sessionId: attempt.sessionId,
      attemptId: attempt.id,
      moduleState: session.moduleState,
      protectedPayload: attempt.protectedPayload,
      rawSubmission: input.rawSubmission,
    });

    await transaction.finishAttemptAndAdvanceSession({
      attempt,
      rawSubmission: input.rawSubmission,
      moduleResult,
    });

    return {
      publicResult: moduleResult.publicResult,
      nextScreen: moduleResult.nextScreen,
    };
  });
}
```

This code is generic. It performs the same security checks for Vocabulary, Reading, Math, or any future module.

The module-specific adapter is called only after the shared checks succeed.

---

## Generic API route

The browser no longer needs a Vocabulary-specific answer route such as:

```text
/api/learning/vocabulary/submit-answer
```

It can use one shared endpoint:

```text
/api/learning/submit-answer
```

Example route:

```ts
// src/app/api/learning/submit-answer/route.ts

export async function POST(request: Request): Promise<Response> {
  const learner = await requireAuthenticatedLearningUser();
  const body = await parseGenericLearningSubmission(request);

  if (!body) {
    return invalidLearningSubmissionResponse();
  }

  const result = await submitLearningAnswer({
    learnerId: learner.id,
    attemptId: body.attemptId,
    rawSubmission: body.submission,
  });

  return learningSubmissionResponse(result);
}
```

The generic parser validates only the generic envelope:

```ts
type GenericLearningSubmission = {
  attemptId: string;
  submission: unknown;
};
```

Vocabulary validates the contents of `submission`. The shared route does not.

---

## Example browser request

The browser sends:

```json
{
  "attemptId": "2e537b26-393c-4a27-b93d-42b77f497914",
  "submission": {
    "answerType": "definition",
    "selectedChoiceId": "29cafca0-861a-49a1-b98c-a74e48763706"
  }
}
```

The engine understands only:

```text
attemptId = which protected attempt to load
submission = opaque module data to pass to the registered module
```

Vocabulary understands:

```text
answerType = definition
selectedChoiceId = the learner's selected Vocabulary choice
```

That separation keeps the engine reusable without making modules responsible for generic security.

---

## What disappears from Vocabulary

After the future migration is fully completed and existing active records have been handled safely, these Vocabulary-owned security responsibilities should be removed:

```text
VocabularyContentCapabilityStore
Vocabulary-owned runtime capability storage
Vocabulary-owned attempt expiration
Vocabulary-owned duplicate/replay infrastructure
Vocabulary-specific generic submit-answer route
Vocabulary-specific transaction/concurrency security code
```

Do not delete the Vocabulary grading logic, submission parser, lesson state machine, word selection, mastery logic, review logic, checkpoint logic, or screen builders.

---

## What must not happen

The redesign must not make the Learning Engine understand Vocabulary.

Bad shared-engine code:

```ts
if (moduleName === "vocabulary") {
  checkCorrectSpelling();
}
```

Bad shared enum:

```ts
type AttemptKind =
  | "VOCABULARY_DEFINITION"
  | "VOCABULARY_SPELLING"
  | "READING_QUESTION";
```

Bad shared database logic:

```ts
if (attempt.answerType === "spelling") {
  updateVocabularyMastery();
}
```

Correct shared-engine code:

```ts
const adapter = getLearningModuleServerAdapter(attempt.moduleName);
const result = await adapter.gradeAndAdvance(context);
```

The engine secures and coordinates. The module interprets and teaches.

---

## Migration considerations for the future feature

This redesign should be implemented as its own major feature, not slipped into an unrelated module change.

The implementation plan must address:

1. The final shared session, capability, and attempt schema.
2. How active Vocabulary runtime records are migrated, allowed to expire, or deliberately invalidated.
3. How module adapters are registered without creating subject branches in the engine.
4. How engine transactions call module grading without creating partial state.
5. How module payloads are versioned and strictly validated.
6. How exact duplicate submissions remain idempotent.
7. How changed duplicates, stale attempts, and cross-learner attempts are rejected.
8. How failures remain recoverable without silently advancing progression.
9. How the current Vocabulary browser/API contracts are migrated safely.
10. How new modules can adopt the shared security pipeline without copying Vocabulary code.
11. Which Learning Engine, module, database, security, API, and testing rules must be updated to reflect the approved ownership change.

Do not build this redesign until the current Vocabulary database-runtime feature is completed and this larger architecture is deliberately specified and reviewed.

---

## Tests the final architecture must have

The finished shared system must prove:

- One generic security pipeline works for at least two different test module adapters.
- The engine never interprets either module's answer payload.
- A session or attempt created by one running backend copy works through another.
- Protected answers cannot be reconstructed from browser-visible data.
- Cross-learner, cross-session, cross-module, expired, stale, consumed, and altered attempts fail safely.
- An exact duplicate submission returns the stored result without applying progress twice.
- A changed duplicate is rejected.
- Simultaneous submissions produce one committed result.
- Database failure rolls back the attempt and module-state change together.
- Vocabulary progression remains identical before and after the infrastructure migration.
- A second module can use the infrastructure without adding subject-specific branches or enums to the engine.

---

## Short version to remember later

The immediate database feature solves this:

```text
Vocabulary security records are no longer trapped in one server's memory.
```

The future engine redesign must solve this:

```text
Vocabulary should not own and rebuild generic learning security at all.
```

The final rule is:

```text
Learning Engine:
  secure the session
  secure the capability
  secure the attempt
  store records
  prevent replay
  handle duplicate and simultaneous requests
  call the registered module

Vocabulary module:
  build Vocabulary content
  validate Vocabulary answers
  grade Vocabulary answers
  update Vocabulary mastery
  decide the next Vocabulary screen
```

That gives Brain Genius one strong, reusable security system while keeping every learning module in complete control of its own subject.
