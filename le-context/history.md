## 2026-06-27 00:00

- Built the Learning Engine layout shell: Header, Sidebar, and GamingWindow components (src/components/blocks/)
- Set up brand background, color tokens, and font variables (Baloo 2 / Plus Jakarta Sans) in globals.css, matching the documents/vocab_app reference
- Composed Header + Sidebar + GamingWindow in page.tsx; components are static, prop-less raw markup with no logic
- Documented each component in docs/components/
- Audited the branch against context/coding-rules.md and fixed all findings: flat reference background (removed invented gradient), restored full Sidebar timer panel, moved components into src/components/blocks/, replaced hardcoded hex/rgba with theme tokens, added src/lib/emojis.ts for icon glyphs
- Verified with `tsc --noEmit` and a local `next dev` render

## 2026-06-27 00:00

- Added catch-all route `src/app/learning/[...learning]/page.tsx` to parse module name and module variables from the URL
- Module name is the first path segment, moduleVariables is an array of the remaining segments
- Printed both values to the screen for confirmation
- Verified with `tsc --noEmit` and a local `next dev` request to `/learning/vocabulary/ie928idi/english`

## 2026-06-27 00:00

- Proved the Learning Engine can load the Vocabulary module and render its StartScreen inside the shared GamingWindow component
- Implemented `GameEngine.start(moduleName, moduleVariables)` to resolve and load the active module
- Implemented `GameEngine.showOnWindow(activeModule.startScreen)` to render the module's start screen inside GamingWindow
- Scope limited to the vocabulary module only — no registry, navigation, state, timers, scoring, or audio
- Verified with `tsc --noEmit` and a local `next dev` render

## 2026-06-28 00:00

- Refactored GameEngine to dynamically import learning modules from src/learning-modules/${moduleName} instead of hardcoding vocabulary-specific imports/if-checks
- Replaced ActiveModule.startScreen with an active-module API: showStartScreen(), clickedNext(), clickedPrevious(), clickedAnswer() (LearningModule.start() now returns this object)
- Created src/learning-modules/vocabulary/index.ts as the Vocabulary module entry point, adapting the existing VocabularyModule.tsx StartScreen function
- page.tsx now awaits the async GameEngine.start() and calls activeModule.showStartScreen()
- Verified with tsc --noEmit and next build (route /learning/[...learning] compiles and renders the Vocabulary start screen)
- Passed audit with no high/medium findings

## 2026-06-29 00:00

- Renamed `StartScreenConfig` to `ScreenConfig` in src/types/learning.ts and all usages (GameEngine.tsx, GamingWindow.tsx, VocabularyModule.ts), since the type now describes any screen a module returns, not just the start screen
- Added `showHeader?`/`showSidebar?` flags to `ScreenConfig`
- `GameEngine.showOnWindow` now conditionally renders `Header`/`Sidebar` around `GamingWindow` based on those flags
- Vocabulary's `StartScreen` sets `showHeader: true, showSidebar: true` as the end-to-end example
- Verified with `tsc --noEmit`

## 2026-06-29 00:01

- Refactored `GameEngine` into an instantiable runtime/session object: `new GameEngine(moduleName, moduleVariables)` then `await engine.showStartScreen()`
- Added a private `activeModule` property so the engine owns the active module for the lifetime of the session instead of recreating it per call
- Replaced `loadModule()` with `initialize()`, which loads and creates the active module only once and stores it on `this.activeModule`
- `showStartScreen()` now calls `initialize()` and operates on `this.activeModule` instead of a local variable
- Updated `page.tsx` to use the new instance-based API
- Verified with `tsc --noEmit`

## 2026-06-29 00:02

- Converted the learning route (`src/app/learning/[...learning]/page.tsx`) to a client page that owns `currentScreen` and `shellSettings` React state, booting the engine in a `useEffect` keyed on the route segments
- Split engine responsibilities into `initialize()` (loads the module, stores the screen-update callback, returns only `ShellSettings`) and `showStartScreen()` (asks the active module for the start screen and pushes it into React state)
- Removed all JSX/UI ownership from `GameEngine` — no more imports of `Header`, `Sidebar`, or `GamingWindow`; the engine only decides screen data, the page renders the shell
- Added `ShellSettings` type to `src/types/learning.ts` and split it from `ScreenConfig`; `ActiveModule` now exposes `getInitialShellSettings()` separately from `showStartScreen()`
- Updated the Vocabulary active module to implement `getInitialShellSettings()` and `showStartScreen()` without importing engine UI components
- Added private guards (`getActiveModule()`, `getScreenUpdater()`) that throw if `initialize()` hasn't run or no screen callback was registered
- Verified with `tsc --noEmit` and `next build` (route compiles and renders the Vocabulary start screen with Header/Sidebar driven by `ShellSettings`)

## 2026-06-30 00:00

- Refactored `GameEngine` so the page owns all React state; `initialize()` now accepts an `EngineStateSetters` object (`setCurrentScreen`, `setShowHeader`, `setShowSidebar`) instead of returning `ShellSettings`
- Engine stores the setters and calls them directly from `showStartScreen()` to drive header/sidebar visibility and the active screen
- Added `validateStateSetters()` to throw immediately if a required setter is missing during initialization
- Updated `src/types/learning.ts` with the new `EngineStateSetters` type
- Updated `page.tsx` to create `showHeader`/`showSidebar` state and pass the setters object into `engine.initialize()`
- Verified with `tsc --noEmit`

## 2026-07-01 00:00

- Refactored vocabulary module to be fully self-contained under `src/learning-modules/vocabulary/`
- Moved screen-building logic into `src/learning-modules/vocabulary/screens/startScreen.ts`
- Moved action handlers into `src/learning-modules/vocabulary/actions/` (clickedNext, clickedPrevious, clickedAnswer)
- Added `src/learning-modules/vocabulary/settings.json` for static shell settings (`showHeader`, `showSidebar`)
- Deleted `src/modules/vocabulary/VocabularyModule.ts` and removed the split `src/modules/` folder
- Updated `src/learning-modules/vocabulary/index.ts` as the sole public contract between GameEngine and Vocabulary
- Replaced `activeModule.getInitialShellSettings()` with `activeModule.settings` in `GameEngine.ts`
- Removed `getInitialShellSettings` and `ShellSettings` from `src/types/learning.ts`; engine now reads settings directly from the module
- GameEngine remains fully generic with no Vocabulary-specific imports

## 2026-07-01 00:01

- Moved module shell settings out of `ActiveModule` and into `src/learning-modules/vocabulary/setting.json` (singular)
- Deleted the old `settings.json` file; renamed to `setting.json` per the required module file convention
- Updated `GameEngine.initialize()` to dynamically import `setting.json` for the requested module and validate `showHeader`/`showSidebar` as booleans
- Engine now calls `setShowHeader()` and `setShowSidebar()` directly from `initialize()` using the JSON values
- Simplified `showStartScreen()` to only call `setCurrentScreen(activeModule.showStartScreen())`
- Removed `activeModule.settings` usage from the engine; `ActiveModule` type no longer requires a `settings` property
- Added `ModuleSettings` type to `src/types/learning.ts`
- Verified with `tsc --noEmit` and `next build`

## 2026-07-02 00:00

- Converted the startup screen into the first reusable engine window (`StartupWindow`) in `src/components/engine-windows/startup/`
- Created `src/lib/engine/EngineWindowRegistry.ts` as the core engine-owned map from window name to React component; only `startup` registered for now
- Updated `src/types/learning.ts`: `ScreenConfig` now holds `{ WindowComponent: ElementType, props: Record<string, unknown> }` instead of raw title/message; added `StartupScreenData` type; `ActiveModule.showStartScreen()` returns `StartupScreenData`
- Updated `GameEngine.showStartScreen()` to resolve `StartupWindow` via the registry, combine it with vocabulary data, and push the generic `ScreenConfig` into state
- `GamingWindow` is now a generic host: it renders `screen.WindowComponent` with `screen.props` and no longer references `screen.title` or `screen.message`
- Vocabulary `startScreen.ts` returns only `{ title, message }` with no imports of engine or UI components
- Visible startup UI and header/sidebar behavior remain unchanged
- Verified with `tsc --noEmit` and `next build`

## 2026-07-03 00:00

- Built the real reusable BrainGenius startup screen for the Vocabulary module inside the engine-owned `StartupWindow`
- Replaced the simple `StartupScreenData` type in `src/types/learning.ts` with the full configuration structure: `StartupStat`, `StartupActionVariant`, `StartupAction`, `StartupVisual`, and the expanded `StartupScreenData` (eyebrow, title, description, stats, pathSteps, actions, visual)
- Updated `src/learning-modules/vocabulary/screens/startScreen.ts` to return realistic fixture data (mission stats, path steps, one primary action, vocabulary-book visual); module still returns pure config with no React/component imports
- Rebuilt `StartupWindow.tsx` with three named areas — ContentPanel (eyebrow, title, description, stat chips, "YOUR PATH TODAY" pills), ActionPanel (maps `actions` into primary/secondary/ghost buttons, natural width, calls `onAction?.(actionId)`), and VisualPanel (vocabulary-book gradient stage with floating word chips)
- Matched existing BrainGenius visual language (frosted surfaces, navy/lime/cyan theme tokens, Baloo display font) with no new colors or design system
- Added new emoji glyphs to `src/lib/emojis.ts` and documented the component in `docs/components/StartupWindow.md`
- Left `GameEngine.ts`, routing, header, sidebar, registry, and `GamingWindow.tsx` untouched
- Verified with `tsc --noEmit` and a local `next dev` render

## 2026-07-03 00:01

- Refactored `StartupScreenData` (src/types/learning.ts) to `{ contentPanel, visualPanel, actionPanel: { buttons } }`, replacing the field-by-field config shape with React nodes for content/visual
- `StartupWindow` no longer knows about eyebrow/title/description/stats/pathSteps/visual — it now only renders the layout shell (ContentPanel + ActionPanel on the left, VisualPanel on the right) and keeps `ActionPanel` config-driven off `actionPanel.buttons`
- Created `VocabularyStartupContent.tsx` and `VocabularyStartupVisual.tsx` under `src/learning-modules/vocabulary/components/startup/`, moving the eyebrow/title/description/mission chips/path steps and the book visual/floating words out of the engine and into the Vocabulary module
- `src/learning-modules/vocabulary/screens/startScreen.ts` renamed to `.tsx` and now returns `contentPanel`/`visualPanel` as JSX alongside the existing config-driven `actionPanel`
- No action/navigation pipeline added; `GameEngine`/`EngineWindowRegistry` still have no Vocabulary imports
- Verified with `tsc --noEmit`

## 2026-07-03 10:33

- Refactored the module-loading pattern from a factory (`LearningModule.start()`) to direct class instantiation
- `src/types/learning.ts`: replaced `LearningModule` with `LearningModuleConstructor = new (moduleVariables: string[]) => ActiveModule`
- `GameEngine.ts`: now does `new ModuleConstructor(moduleVariables)` instead of `learningModule.start(moduleVariables)`
- `src/learning-modules/vocabulary/index.ts`: replaced the `VocabularyModule` object/`start()` factory with a `Vocabulary` class implementing `ActiveModule`, storing only `vocabListId` from `moduleVariables[0]`
- `startScreen.tsx` now takes a named `vocabListId: string` argument instead of the raw `moduleVariables` array
- No changes to routing, `page.tsx`, registry, or startup UI/layout
- Verified with `tsc --noEmit` and `npm run lint`

## 2026-07-03 00:00

- Wired startup-button clicks through to the active learning module via a generic action pipeline, without changing any visible UI
- `src/types/learning.ts`: `StartupAction` now carries its own `action: string`; `ActiveModule` interface replaced `clickedNext`/`clickedPrevious`/`clickedAnswer` with a single `action(actionId: string): void`
- Extracted the reusable `Button` component (visual markup, variants, icon/helper-text rendering) out of `StartupWindow` into `src/components/ui/Button.tsx`, documented in `docs/components/Button.md`; it takes plain UI props and has no knowledge of `StartupAction`/engine/module types
- `StartupWindow.tsx` keeps `ActionPanel`, now built on the shared `Button`, and forwards each button's `action.action` (not `action.id`) through a required `onAction` callback
- `src/learning-modules/vocabulary/screens/startScreen.tsx`: start-lesson button now sends `action: "next"`
- `src/learning-modules/vocabulary/index.ts`: added `action(actionId)` with a switch on `"next"` → `clickedNext()`, throwing on unsupported actions
- `GameEngine.ts`: added `action(actionId)` that delegates to the active module, and `showStartScreen()` now passes `onAction: (actionId) => this.action(actionId)` into `StartupWindow` props
- Verified end-to-end click flow: Button → ActionPanel → StartupWindow.onAction → GameEngine.action → Vocabulary.action → clickedNext()
- Passed audit and user review

## 2026-07-03 17:00

- Added private `withSharedScreenProps<T extends object>(screenProps: T)` helper to `GameEngine.ts` that merges module-supplied screen props with the shared `onAction` callback
- Replaced the inline `{ ...startupProps, onAction: ... }` object in `showStartScreen()` with `this.withSharedScreenProps(startupProps)`
- Establishes the pattern for all future engine-owned screen transitions to use `withSharedScreenProps` instead of repeating `onAction` manually
- Verified with `tsc --noEmit`

## 2026-07-03 17:01

- Replaced `Vocabulary.action(actionId)` and its switch statement with a command-map pattern
- Added `ActionCommands = Record<string, () => void>` to `src/types/learning.ts`; `ActiveModule` now requires `getActionCommands(): ActionCommands` instead of `action(actionId: string): void`
- `src/learning-modules/vocabulary/index.ts`: `Vocabulary.getActionCommands()` returns `{ next: () => clickedNext() }`
- `GameEngine.ts`: added `private actionCommands: ActionCommands | null`, populated right after `new ModuleConstructor(...)` in `initialize()`; `action(actionId)` now looks up and calls `this.getActionCommands()[actionId]` directly (throws on missing command); added private `getActionCommands()` guard
- No changes to `onAction`, `withSharedScreenProps()`, button action values, UI, layout, or screen logic
- Verified with `tsc --noEmit` and `npm run lint` (no new errors/warnings introduced; pre-existing errors are confined to `documents/vocab_app` reference material)

## 2026-07-04 10:00

- Phase 1: added red, purple, sky, and neutral color tokens to `src/app/globals.css` (`:root` and `@theme inline`), matched against real colors used in the reference `QuizScreen.tsx`; reused existing `--tint-cyan` rather than adding a new cyan-tint variant
- Phase 2: built `MultipleChoiceWindow` visual shell in `src/components/engine-windows/multiple-choice/` — badge, word box, `ChoiceRow` local sub-component (unanswered/correct/wrong-selected/faded-untouched states), and a feedback row with a Next button
- Added a new `"accent"` variant to `src/components/ui/Button.tsx` for the Next button (cyan-to-sky gradient, cyan glow), without changing the existing `primary`/`secondary`/`ghost` variants
- Made `Button`'s `onClick` prop optional so visual-only buttons don't need a no-op handler
- Added `src/app/playground/page.tsx` rendering all three quiz states with static props; documented in `docs/components/MultipleChoiceWindow.md` and updated `docs/components/Button.md`
- Presentation only — not registered in `EngineWindowRegistry.ts`, no click wiring, `GameEngine`/`learning-modules` untouched
- Verified with `tsc --noEmit` and `eslint`; passed audit (one low-priority finding fixed) and user review

## 2026-07-04 00:00

- Moved ownership of the `"next"` switch command into `GameEngine`
- `src/types/learning.ts`: replaced `ActionCommands` with `SwitchCommands`; `ActiveModule` now requires `next(): void` instead of `getActionCommands()`
- `GameEngine.ts`: replaced `actionCommands` with `private switchCommands: SwitchCommands | null`, built explicitly in `initialize()` as `{ next: () => this.getActiveModule().next() }`; `action(actionId)` now looks up `getSwitchCommands()[actionId]` and throws on missing command; replaced `getActionCommands()` guard with `getSwitchCommands()`
- `src/learning-modules/vocabulary/index.ts`: removed `getActionCommands()` and the `clickedNext` import; added an intentionally empty `next(): void`
- Deleted the obsolete `src/learning-modules/vocabulary/actions/clickedNext.ts`
- No changes to startup screen, button action value, `StartupWindow`, `EngineWindowRegistry`, or any visible UI
- Verified with `tsc --noEmit` and `npm run lint`; clicking Start 5-Word Lesson still causes no visible UI change

## 2026-07-04 12:07

- Added action payload transport to the existing single-command pipeline: `onAction("next")` → `GameEngine.action("next", {})` → `switchCommands["next"]({})` → `activeModule.next({})`
- `src/types/learning.ts`: added `ActionPayload = Record<string, unknown>` and `OnAction = (actionId: string, payload?: ActionPayload) => void`; `SwitchCommands` values and `ActiveModule.next` now take a required `payload: ActionPayload`
- `GameEngine.ts`: `action(actionId, payload = {})` now passes `payload` into the switch command; `withSharedScreenProps()` builds a typed `OnAction` that defaults payload to `{}` before calling `this.action()`
- `src/learning-modules/vocabulary/index.ts`: `next()` now accepts an unused `_payload: ActionPayload`, still a no-op
- `StartupWindow.tsx`: `onAction` prop typed as the shared `OnAction` instead of an inline `(actionId: string) => void`; Start button call and UI unchanged
- No new commands, `submit-answer`, return values, setters, or UI changes added
- Verified with `tsc --noEmit` and `npm run lint`; clicking Start 5-Word Lesson still causes no visible UI change and `Vocabulary.next()` receives `{}`

## 2026-07-04 00:01

- Added shared `correctAnswer` state plumbing: `LearningPage` owns the live value, registers `setCorrectAnswer` with `GameEngine`, and passes `correctAnswer` into `ScreenRenderer`, which injects it into the active window
- `src/types/learning.ts`: added `CorrectAnswer = string | null`; `EngineStateSetters` now requires `setCorrectAnswer`
- `src/app/learning/[...learning]/page.tsx`: added `correctAnswer` state (initial `null`), passed `setCorrectAnswer` into `engine.initialize()` and `correctAnswer` into `ScreenRenderer`
- `src/lib/engine/GameEngine.ts`: added `"setCorrectAnswer"` to `REQUIRED_SETTERS`; setter stored on the existing `engineStateSetters` object, no new field
- `src/components/blocks/ScreenRenderer.tsx`: added `correctAnswer` prop, injected into the active window after the screen-props spread
- `src/components/engine-windows/multiple-choice/MultipleChoiceWindow.tsx`: renamed `correctChoiceId` prop to `correctAnswer: CorrectAnswer`, updated `answered`/`isCorrect` derivations and per-choice comparisons
- No click wiring, submit-answer command, screen switching, or Vocabulary answer-checking logic added; `correctAnswer` stays `null` until a later feature sets it
- Verified with `tsc --noEmit` and `npm run lint`; passed audit and user review

## 2026-07-04 18:00

- Made the Vocabulary module's `"next"` action visibly transition from the startup screen to `MultipleChoiceWindow`, establishing the rule that the active module decides the next screen while `GameEngine` performs the actual screen change
- `src/types/learning.ts`: added `ScreenRequest = { windowName: EngineWindowName; props: Record<string, unknown> }` (type-only import from `EngineWindowRegistry`); `SwitchCommands` values and `ActiveModule.next()` now return `ScreenRequest | void` / `ScreenRequest`
- `src/lib/engine/EngineWindowRegistry.ts`: registered `MultipleChoiceWindow` under the `"multiple-choice"` key alongside `"startup"`
- `src/lib/engine/GameEngine.ts`: added private `changeScreen(screenRequest)` that resolves the window via the registry, resets `correctAnswer` to `null`, and sets `currentScreen` with props merged through the existing `withSharedScreenProps()`; `action()` now captures the switch command's return value and calls `changeScreen()` only when a request is returned
- `src/learning-modules/vocabulary/index.ts`: `next()` now returns `createMultipleChoiceScreenRequest()` from the new `src/learning-modules/vocabulary/screens/multipleChoiceScreen.ts`, hardcoded to the "brilliant" placeholder question/choices
- No answer-click wiring, `submitAnswer`, scoring, or styling changes added
- Verified with `tsc --noEmit` and `npm run lint`; passed audit and user review

## 2026-07-04 16:40

- Applied the full approved rename-cleanup pass across the engine, Vocabulary module, and docs, with no runtime behavior changes
- Renamed: `CorrectAnswer`/`correctAnswer`/`setCorrectAnswer` → `CorrectChoiceId`/`correctChoiceId`/`setCorrectChoiceId`; `SwitchCommands`/`switchCommands`/`getSwitchCommands`/`switchCommand` → `ActionHandlers`/`actionHandlers`/`requireActionHandlers`/`actionHandler`
- Renamed: `getEngineWindow` → `resolveEngineWindow` (and its local `window` var → `Component`); `showStartScreen` → `showStartupScreen`; `startScreen.tsx` → `startupScreen.tsx`; `setting.json` → `settings.json`
- Renamed: `StartupAction`/`StartupActionVariant` → `StartupButtonConfig`/`StartupButtonVariant` with `action`/`actions` → `actionId`/`buttons`; `MultipleChoiceProps` → `MultipleChoiceWindowProps`; `isCorrect` → `isSelectedAnswerCorrect` (selection-vs-correct comparison only); local `style` → `choiceStyle` in `ChoiceRow`
- Renamed: `getActiveModule`/`getStateSetters` → `requireActiveModule`/`requireEngineStateSetters` (same throw behavior); `REQUIRED_SETTERS` → `REQUIRED_ENGINE_STATE_SETTER_KEYS`; `currentScreen`/`setCurrentScreen` → `activeScreen`/`setActiveScreen`; `ScreenConfig` → `ActiveScreen`; `bootEngine` → `initializeLearningEngine`
- Deleted unused legacy stubs `src/learning-modules/vocabulary/actions/clickedAnswer.ts` and `clickedPrevious.ts`
- Updated `context/coding-rules.md`, `context/tech-stack.md`, and `docs/components/{Button,MultipleChoiceWindow,StartupWindow}.md` to the new terminology
- `ScreenRequest`, `ActionPayload`, `onAction`, action ID string values, and registry/screen behavior were left unchanged, as required
- Verified with `tsc --noEmit`, `npm run lint`, and `npm run build` (all clean); confirmed no stale old identifiers remain anywhere in source or active docs; passed audit and user review

## 2026-07-04 18:30

- Replaced the hardcoded multiple-choice fixture with a temporary local word-list loader owned by the Vocabulary module
- Added `src/learning-modules/vocabulary/data/getWordList.ts` exporting `VocabularyWord`/`VocabularyChoice` types and `getWordList(wordListId)`, returning the five-word fixture for `"word_list_id"` and throwing on any other ID
- `src/learning-modules/vocabulary/index.ts`: renamed `vocabListId` → `wordListId`; added `private wordList: VocabularyWord[] | null`; `next()` now loads the list once via `getWordList()`, guards against an empty list, and passes the first `VocabularyWord` into the screen request
- `src/learning-modules/vocabulary/screens/multipleChoiceScreen.ts`: `createMultipleChoiceScreenRequest(word: VocabularyWord)` now builds `question`/`choices` from the supplied word instead of the hardcoded "brilliant" fixture; `correctChoiceId` is not passed into props
- `src/learning-modules/vocabulary/screens/startupScreen.tsx`: renamed its `vocabListId` parameter to `wordListId` to match
- Updated `context/tech-stack.md` prototype-scope bullet to describe the new word-list loading flow
- No changes to answer clicking, selection state, scoring, progression, or the engine/registry/renderer
- Verified with `tsc --noEmit` and `npm run lint`; manually confirmed `/learning/vocabulary/word_list_id` → Start 5-Word Lesson shows "brilliant" with its four choices; passed audit and user review

## 2026-07-05 08:33

- Moved vocabulary word-list loading out of `next()` and into module initialization
- `src/types/learning.ts`: `ActiveModule` now requires `initialize(): Promise<void>`
- `src/learning-modules/vocabulary/index.ts`: added async `initialize()` that loads the word list via `getWordList(this.wordListId)` into a new `private vocabList` property; `next()` now reads from `vocabList` through a `requireVocabList()` guard instead of loading it itself
- `src/lib/engine/GameEngine.ts`: `initialize()` now awaits `activeModule.initialize()` immediately after constructing the module, before startup props or actions can be requested
- Updated `context/tech-stack.md` to describe the new initialize-time loading flow
- Audited against `context/current-feature.md`; fixed all findings: renamed the new property to match the spec (`vocabList`), reverted an out-of-scope fixture wording change, and corrected stale `tech-stack.md` wording
- Verified with `tsc --noEmit` and `npm run build` (both clean); passed audit and user review

## 2026-07-05 12:00

- Wired the first complete in-memory multiple-choice answer contract: `MultipleChoiceWindow` submits an answer, `Vocabulary` validates it, `GameEngine` applies the feedback state
- `src/types/learning.ts`: added `SubmitAnswerPayload`/`SubmitAnswerResult`; `ActiveModule` now requires `submitAnswer(payload): SubmitAnswerResult` alongside `next()`
- `src/lib/engine/GameEngine.ts`: registered a `submitAnswer` action handler that narrows/validates the generic payload, calls `activeModule.submitAnswer()`, and applies the result via `setCorrectChoiceId()`, returning `void` so no screen change occurs
- `src/learning-modules/vocabulary/index.ts`: added private `wordIndex`, `nextAttemptId`, and `activeAttempt` state; `next()` now advances through the word list and stores the active attempt's answer key; `submitAnswer()` validates the attempt/selected choice and returns only `{ correctChoiceId }`
- `src/learning-modules/vocabulary/screens/multipleChoiceScreen.ts`: screen request now includes the generated `attemptId`
- `src/components/engine-windows/multiple-choice/MultipleChoiceWindow.tsx`: choices are real buttons that emit `submitAnswer`/`next`; local `selectedChoiceId` state drives per-choice feedback styling and resets on each new `attemptId`
- Also fixed the root redirect fixture ID (`/learning/vocabulary/word_list_id`) so it matches the real fixture list, and updated the playground page to the new `attemptId`/`onAction` props
- Updated `docs/components/MultipleChoiceWindow.md`, `context/coding-rules.md`, `context/tech-stack.md`, and `context/project-overview.md` to describe the new answer-contract flow
- Verified with `tsc --noEmit`, `npm run lint`, and `npm run build`; passed audit and user review

## 2026-07-05 00:00

- Separated vocabulary fixture data into a public-question boundary and a distinct answer-lookup boundary, with no change to the engine/module action contract
- `src/learning-modules/vocabulary/data/getWordList.ts`: removed `correctChoiceId` from `VocabularyWord` and every fixture word; now returns public question data only (id, word, choices)
- Added `src/learning-modules/vocabulary/data/getCorrectAnswer.ts`: a separate module-level fixture map (`FIXTURE_CORRECT_ANSWER_IDS`, not exported) exposing only `getCorrectAnswer(wordId): string`, throwing on an unknown ID
- `src/learning-modules/vocabulary/index.ts`: `ActiveAttempt` now holds only `attemptId`, `wordId`, `validChoiceIds`, `answered` — no stored answer key; `next()` builds this attempt without calling `getCorrectAnswer()`; `submitAnswer()` runs its existing stale/duplicate/invalid-choice validation first, then calls `getCorrectAnswer(activeAttempt.wordId)` only after validation passes, and returns `{ correctChoiceId }`
- `multipleChoiceScreen.ts` screen-request props unchanged (`attemptId`, `question`, `choices`); `GameEngine` and `MultipleChoiceWindow` untouched and still never import or call `getCorrectAnswer()`
- Updated `context/tech-stack.md` and `context/project-overview.md` to describe the new public-data/answer-lookup split and its temporary-fixture limitation (not production server-side answer secrecy)
- Verified with `tsc --noEmit` and `npm run lint` (both clean for the changed files; pre-existing findings remain confined to `documents/vocab_app` reference material); passed audit and user review

## 2026-07-05 00:01

- Built two new visual-only engine windows, both playground-proven only (not registered, not wired into the live vocabulary lesson)
- Added `DefinitionDisplay` (`src/components/engine-windows/definition-display/`): engine version of the reference app's `IntroWordScreen`, taking `{ word, definition, exampleSentences, onAction }`; renders the speaker icon and word heading, the definition panel, and a green example-sentences panel (blank sentences filtered out); speaker click emits `onAction("speak", { word })`, Next emits `onAction("next")`
- Added `DefinitionFunFact` (`src/components/engine-windows/definition-fun-fact/`): engine version of the reference app's `IntroFactScreen`, taking `{ word, interestingFact, onAction }`; renders the "Fun Fact About This Word!" heading, the word, and the fact card; Next emits `onAction("next")`
- Both components adapt the reference visual structure to this project's existing CSS variables, Baloo display font, and shared `Button` component; `topBar`/`sidebar` props from the reference were intentionally dropped since the outer learning-page layout already owns those
- Updated `src/app/playground/page.tsx` to render both components below the existing `MultipleChoiceWindow` examples using the "anxious" fixture data, with a no-op `onAction`
- No changes to `EngineWindowRegistry`, `GameEngine`, `Vocabulary`, `ActiveModule`/`ScreenRequest` types, or `MultipleChoiceWindow`
- Verified with `tsc --noEmit` and `npm run lint`

## 2026-07-05 12:00

- Renamed GameEngine to LearningEngine across runtime code, active architecture documentation, and package metadata to distinguish lesson flow/orchestration from future gamification systems
- `src/lib/engine/GameEngine.ts` → `src/lib/engine/LearningEngine.ts`; class, initialization error message, and default export renamed to `LearningEngine`
- `src/app/learning/[...learning]/page.tsx`: imports and constructs `LearningEngine`; ref renamed `engineRef` → `learningEngineRef`; behavior unchanged
- `package.json` / `package-lock.json`: package name `game_engine` → `learning_engine`
- Updated all active `GameEngine` references in `context/coding-rules.md`, `context/tech-stack.md`, and `docs/components/` (Button, MultipleChoiceWindow, StartupWindow); removed the stale `docs/components/GamingWindow.md`, which documented a component deleted from the codebase
- Old history entries intentionally preserved with their original `GameEngine`/`GamingWindow` wording
- Verified with `tsc --noEmit`, `npm run lint`, and `npm run build`

## 2026-07-05 13:00

- Completed the GameEngine-to-LearningEngine rename feature
- All runtime code, architecture docs, and package metadata updated
- Feature cleared from `context/current-feature.md` and logged to history

## 2026-07-05 14:00

- Renamed the generic engine implementation namespace to the Learning Engine namespace and converted React component directories to PascalCase
- Filesystem: `src/lib/engine/` → `src/lib/learning-engine/`; `EngineWindowRegistry.ts` → `LearningEngineWindowRegistry.ts`; `src/components/blocks/` → `src/components/Blocks/`; `src/components/ui/` → `src/components/UI/`; `src/components/engine-windows/` → `src/components/LearningEngineWindows/` with each window folder (`startup`, `multiple-choice`, `definition-display`, `definition-fun-fact`) renamed to PascalCase (`Startup`, `MultipleChoice`, `DefinitionDisplay`, `DefinitionFunFact`); `src/learning-modules/vocabulary/components/startup/` → `.../components/Startup/`
- Identifiers: `ENGINE_WINDOWS` → `LEARNING_ENGINE_WINDOWS`; `EngineWindowName` → `LearningEngineWindowName`; `resolveEngineWindow()` → `resolveLearningEngineWindow()`; `EngineStateSetters` → `LearningEngineStateSetters`; `REQUIRED_ENGINE_STATE_SETTER_KEYS` → `REQUIRED_LEARNING_ENGINE_STATE_SETTER_KEYS`; `engineStateSetters` → `learningEngineStateSetters`; `requireEngineStateSetters()` → `requireLearningEngineStateSetters()`; `validateStateSetters()` → `validateLearningEngineStateSetters()`
- Updated all import paths across `page.tsx` (learning + playground), Learning Engine window components, and shared type files to match; updated error messages to reference "Learning Engine" instead of generic "engine"
- Added a permanent "Engine and Component Naming" section to `context/coding-rules.md` (engine namespace rule, React component directory naming rule, lowercase-folder exceptions, engine window key rule); updated `context/project-overview.md`, `context/tech-stack.md`, `.claude/skills/audit/SKILL.md`, and `.claude/skills/verify/SKILL.md` to the new terminology
- No runtime, styling, action-contract, or screen-flow changes; registry keys remain kebab-case (`"startup"`, `"multiple-choice"`)
- Verified: `rg` sweep for old engine-namespace identifiers/paths found no matches outside `context/current-feature.md` and `context/history.md`; `tsc --noEmit` clean; `npm run lint` clean for changed `src/` files (only pre-existing `documents/vocab_app` reference-material findings and one unrelated pre-existing `<img>` warning remain); `npm run build` succeeded
- Feature cleared from `context/current-feature.md` and logged to history

## 2026-07-05 15:00

- Refactored `LearningEngine.ts` from a monolithic class into a thin orchestrator that delegates to focused helper modules, with no runtime/behavior changes
- Added `initialization/loadLearningModule.ts` (dynamic module + settings.json import) and `initialization/validateModuleSettings.ts` (showHeader/showSidebar boolean checks)
- Added `validation/requiredLearningEngineStateSetterKeys.ts`, `validation/validateLearningEngineStateSetters.ts`, and `validation/parseSubmitAnswerPayload.ts` (state-setter and submit-answer payload validation, same error messages)
- Added `actions/createLearningEngineActionHandlers.ts`, building the `next`/`submitAnswer` action map from `getActiveModule()`/`getLearningEngineStateSetters()` callbacks instead of the class itself
- Added `screens/withSharedScreenProps.ts` and `screens/changeLearningEngineScreen.ts`, moving shared-prop injection and screen-transition plumbing (registry resolution, `correctChoiceId` reset, `setActiveScreen`) out of the class; used by both `showStartupScreen()` (no reset) and the normal action-driven transition (resets `correctChoiceId`)
- `LearningEngine.ts` now retains only `activeModule`/`learningEngineStateSetters`/`actionHandlers` fields, `initialize()`/`showStartupScreen()`/`action()` public methods, and its guard methods; `LearningEngineWindowRegistry.ts` stayed at the root as required
- No changes to the Learning Module contract, action contract, screen behavior, UI, or registry keys
- Verified with `tsc --noEmit` (clean); passed audit and user review

## 2026-07-05 17:00

- Added Stage 1 Learning Engine route-error handling: a malformed or unavailable learning URL now renders a friendly, engine-owned Error window instead of a blank page or raw client error
- Added `src/lib/learning-engine/errors/LearningRouteError.ts`: `LearningRouteError` (extends `Error`, typed `code`), the four approved codes (`LEARNING_MODULE_NOT_FOUND`, `VOCABULARY_LIST_ID_MISSING`, `VOCABULARY_LIST_NOT_FOUND`, `INVALID_LEARNING_ROUTE`), and `getLearningRouteErrorPresentation()` as the single source of truth for title/message copy
- Added `src/lib/learning-engine/errors/logLearningRouteError.ts`: centralized `console.warn` structured logger (`event`, `code`, `moduleName`, `moduleVariables`, `routePath`, `technicalMessage`, `occurredAt`)
- Added `LearningEngineErrorWindow` (`src/components/LearningEngineWindows/Error/`), registered under the `"error"` key in `LearningEngineWindowRegistry.ts`; renders only `title`/`message` plus a static `Return Home` link to `/`, with no local state or emitted actions
- `loadLearningModule.ts` now uses an explicit supported-module loader map and throws `LEARNING_MODULE_NOT_FOUND` for an unknown module name
- `Vocabulary`'s constructor throws `VOCABULARY_LIST_ID_MISSING`/`INVALID_LEARNING_ROUTE` for a missing/extra route variable; `getWordList()` returns `null` instead of throwing, and `Vocabulary.initialize()` converts that into `VOCABULARY_LIST_NOT_FOUND`
- `LearningEngine.initialize()` now returns `"ready" | "route-error"`, catching only `LearningRouteError` during module load/construction/initialization, logging it once, hiding header/sidebar, and rendering the `error` window via the existing `changeLearningEngineScreen()` helper; every other error still re-throws
- `src/app/learning/[...learning]/page.tsx` only calls `showStartupScreen()` on `"ready"`; split into an outer `LearningPage` (reads the route params) and a `LearningRoute` child keyed by the route path so React remounts fresh state on every learning-route change, avoiding synchronous `setState`-in-effect calls entirely
- Added the "Learning Engine Route Errors" section to `context/coding-rules.md` and `docs/components/LearningEngineErrorWindow.md`
- Verified with `tsc --noEmit`, `npm run build`, and a scoped `eslint` pass on every changed file (all clean); confirmed all 5 required routes via headless-browser testing (normal lesson flow unchanged; the four route-error cases render the exact required title/message, log exactly one structured `console.warn`, and `Return Home` points to `/`)
- Passed audit (one new medium finding — a `react-hooks/set-state-in-effect` error introduced by the initial stale-UI-reset approach — fixed via the keyed-child-component pattern above) and user review

## 2026-07-05 18:00

- Documentation-and-audit-rules update only; no runtime, error-code, UI-copy, or logging behavior changed
- Renamed `context/coding-rules.md` section "Learning Engine Route Errors" to "Learning Engine Error Handling"; reorganized into "Error directory and current required files" (required file paths and responsibilities for `LearningRouteError.ts`/`logLearningRouteError.ts`, naming conventions), "Current route-error handling rules" (unchanged rules, clarified), "Future error categories — do not create yet" (`LearningLessonError.ts`, `LearningRequestError.ts`, React Error Boundary, developer contract errors, documented as planned-only), and a permanent rule against broad catch-all error handling
- Updated `.claude/skills/audit/SKILL.md`: added explicit Learning Engine error-handling checks to `/audit feature` Step 5, and required the same Stage 1 route-error checks on every `/audit full` run regardless of feature relevance, while explicitly excluding not-yet-built future files from being flagged as missing
- `src/lib/learning-engine/errors/LearningRouteError.ts` and `src/lib/learning-engine/errors/logLearningRouteError.ts` were not moved, renamed, merged, or replaced
- Verified with `tsc --noEmit` (clean); confirmed via `git status` that only `context/coding-rules.md`, `.claude/skills/audit/SKILL.md`, and `context/current-feature.md` changed
- Feature cleared from `context/current-feature.md` and logged to history

## 2026-07-10 17:27

- Completed Phase 1 (Multi-Provider Server Synthesis) of Learning Engine API Text-to-Speech, on branch `feature/api-tts-providers`
- Added `POST /api/tts` (Node runtime): validates `{ text, tts }`, dispatches to Google Cloud TTS or Lemonfox through an explicit exhaustive switch, returns raw MP3 with `Cache-Control: no-store`; 400 for invalid input, 500 for missing server config, 502 for upstream failure
- Added shared TTS types (`GoogleTtsConfiguration`, `LemonfoxTtsConfiguration`, `TtsConfiguration`, `SpeakActionPayload`, `DeclarativeSpeechRequest`) to `src/types/learning.ts`, and the provider/model/voice allowlist in `src/lib/learning-engine/speech/supportedTtsConfigurations.ts`
- Added `src/lib/learning-engine/speech/validation/` (route body + provider-config parsers), `src/lib/learning-engine/speech/providers/` (Google and Lemonfox adapters, shared `fetchUpstreamOrThrow`/`fetchWithTimeout`, `synthesizeTts` dispatch), and `src/lib/learning-engine/errors/TtsSynthesisError.ts` + `logTtsSynthesisError.ts` (error contracts placed under `errors/` per coding-rules.md Section 13)
- **Deviation from the written spec, approved by the user beforehand:** this project's Google credentials are a service account (`GOOGLE_TTS_CLIENT_EMAIL`/`GOOGLE_TTS_PRIVATE_KEY`/`GOOGLE_TTS_PROJECT_ID`), not a plain `GOOGLE_CLOUD_TTS_API_KEY`. `googleAuth.ts` signs an RS256 JWT with Node's built-in `crypto` and exchanges it for a short-lived OAuth2 access token (no new dependency), sent as `Authorization: Bearer <token>`; the token is cached in-process and reused until near expiry
- Pinned Node `24.14.1` (`.nvmrc`, `package.json` `engines`), added `"type": "module"`, `allowImportingTsExtensions` in `tsconfig.json`, and `npm run test:tts` running 27 tests on the Node built-in test runner against deterministic fake `fetch` implementations (no real network calls in tests)
- Documented required env vars in `.env.example` (real `.env*` still git-ignored) and updated `context/tech-stack.md` with the new active TTS architecture
- Ran an 8-angle multi-agent audit; verified and fixed all 8 findings (OAuth token caching, correct 400-class error for an internal allowlist-mismatch bug vs. a real 502 upstream failure, preserved original network/timeout errors via `cause`, error-contract file placement, deduplicated adapter fetch/error-handling boilerplate, `NextResponse.json` instead of a hand-rolled JSON helper, avoided an unnecessary response-buffer copy, shared test env-var helper)
- Verified with `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:tts` (27/27), and live requests against real Google and Lemonfox credentials (both returned playable MP3); confirmed no provider code or secrets reach the client bundle
- Passed audit and user review; `context/current-feature.md` left in place (still holds the Phase 2/Phase 3 spec for this multi-phase feature)

## 2026-07-10 18:05

- Completed Phase 2 (Engine-Owned API Playback) of Learning Engine API Text-to-Speech, on branch `feature/learning-engine-api-speech`
- Added `SpeechPlaybackController` (`src/lib/learning-engine/speech/SpeechPlaybackController.ts`): the testable playback core behind `speakText`/`cancelSpeech`/`primeSpeechPlayback`, using an injected-deps seam (`isSupported`, `fetchImpl`, `createAudioElement`, `createObjectURL`, `revokeObjectURL`), a generation counter to invalidate stale async work, one reused `HTMLAudioElement`, sequential queue playback, and exactly-once `onDone` semantics with no dangling promises on mid-playback cancellation
- Added `speechPlaybackService.ts` binding the controller to real browser APIs as the public contract; `normalizeSpeechQueue.ts`, `silentAudioDataUri.ts` (a ~45-byte inline silent WAV for the autoplay-unlock prime), and `validation/parseSpeakActionPayload.ts` (reuses Phase 1's `parseTtsConfiguration.ts`)
- Wired `isSpeaking` into the full engine-owned transient-state lifecycle alongside `correctChoiceId`: `LearningEngineStateSetters`/`requiredLearningEngineStateSetterKeys`, `page.tsx`, `ScreenRenderer`; added the `speak` action to `createLearningEngineActionHandlers()`; `changeLearningEngineScreen()` now unconditionally cancels speech and resets `isSpeaking` at the start of every screen change and starts declarative `ScreenRequest.speak` after applying the screen
- Added a new "Learning Engine API Text-to-Speech" Section 23 to `context/coding-rules.md` and updated `context/tech-stack.md` with the Phase 2 architecture
- 27 new tests (53 total in `tests/tts/`) covering queue normalization, payload validation, sequential playback, cancellation/replacement, stale-generation guards, exactly-once completion, and fetch/audio/autoplay failure paths against deterministic fakes (fake audio element, minimal fake `Response`, no real DOM/network)
- Ran an 8-angle multi-agent audit; verified and fixed the meaningful findings: an in-flight `initializeLearningEngine()` that resolves after route unmount could otherwise trigger speech via the shared singleton with no further chance to cancel it (added a torn-down guard); a dead identity check in `SpeechPlaybackController.settle()`; missing `docs/components/ScreenRenderer.md` for its changed public prop contract; duplicated speak-handling logic between the action handler and `changeLearningEngineScreen()` (extracted `runSpeakRequest.ts`); duplicated generation-staleness checks (extracted `isStale()`). Left two findings as-is with documented reasoning: redundant per-call autoplay priming (negligible cost, correctness favored over micro-optimization) and validating `screenRequest.speak` after the screen commits (matches both the explicit Phase 2 spec ordering and the codebase's existing developer-contract-error pattern already used by `submitAnswer`)
- Verified with `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:tts` (53/53), and a live browser check of the existing vocabulary lesson flow (unchanged behavior, no console errors, no sound plays yet since no module supplies `ScreenRequest.speak` until Phase 3)
- Passed audit and user review; `context/current-feature.md` left in place (still holds the Phase 3 spec)

## 2026-07-10 20:54

- Completed Phase 3 (Vocabulary Multiple-Choice Integration) of Learning Engine API Text-to-Speech on branch `feature/vocabulary-multiple-choice-api-tts`
- Added the module-owned `vocabularyMultipleChoiceTts` Google configuration and passed it through `createMultipleChoiceScreenRequest()` to both `ScreenRequest.speak` for automatic word pronunciation and the `MultipleChoiceWindow` `tts` prop for manual replay
- Replaced the static speaker icon with an accessible pronunciation button that emits the engine-owned `speak` action; answer selection, feedback, and Next behavior remain independent of synthesis and playback
- Updated the playground, component documentation, coding rules, and tech-stack documentation for the live automatic-pronunciation/manual-replay behavior
- Applied full-audit hardening: reject unknown top-level TTS request fields without exposing parser details to clients, validate Google base64 audio before decoding, reject empty Google audio, require Lemonfox `audio/mpeg` responses, and add regression coverage for each case
- Verified with `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `npm run test:tts` (57/57 passing)
- Passed audit and user review; cleared `context/current-feature.md` for the next feature

## 2026-07-11 08:19

- Completed Optional TTS for Multiple Choice on branch `feature/optional-tts-for-multiple-choice`
- Widened the multiple-choice `tts` contract to `TtsConfiguration | null`: valid configurations preserve automatic pronunciation and the manual replay button, while `null` omits declarative speech and hides the pronunciation control without affecting answer submission or progression
- Added focused multiple-choice action helpers and tests covering enabled/disabled TTS, unchanged speech payloads, answer submission with TTS disabled, production screen construction, and rejection of empty TTS configuration at the existing validation boundary
- Updated the playground, component documentation, coding rules, tech-stack documentation, and audit/current-feature workflow references to match the nullable TTS contract
- Verified with `npm run test:multiple-choice` (4/4), `npm run test:tts` (58/58), `npx tsc --noEmit`, `npm run lint`, and `npm run build`; passed audit and user review

## 2026-07-15 16:08

- Renamed the learner-facing **Learning Engine Window** concept to **Learning Window** without renaming the Learning Engine itself or changing runtime behavior
- Renamed `src/components/LearningEngineWindows/` to `src/components/LearningWindows/`; renamed the registry file and public API to `LearningWindowRegistry.ts`, `LEARNING_WINDOWS`, `LearningWindowName`, and `resolveLearningWindow()`
- Renamed `LearningEngineErrorWindow` and its props, source file, test, and component documentation to `LearningErrorWindow`; updated all imports, active documentation, source paths, and the permanent Learning Window convention in `context/coding-rules.md`
- Earlier history entries intentionally retain the old Learning Engine Window names because those names were correct when the entries were written
- Verified with `npm run lint`, `npm run typecheck`, `npm test` (76/76), `npm run build`, and a stale-reference sweep across active source code, tests, configuration, and current documentation

## 2026-07-16 14:46

- Completed the in-memory 20-word Vocabulary lesson on branch `feature/complete-vocabulary-lesson`, including introductions, definition and spelling practice, neutral answer recap, five-word active-pool replacement, delayed reviews, and Lesson Complete.
- Kept canonical answer data server-only through narrow, capability-backed per-screen content projections; definition choice IDs and spelling speech references are opaque, and spelling target words remain absent from pre-grading browser data.
- Added generic server-resolved speech-source support to the shared Learning Engine, while keeping Vocabulary-specific parsing, progression, content resolution, answer evaluation, and review state within the Vocabulary module.
- Added learning-window, route, endpoint, integration, security, state-machine, TTS, and end-to-end coverage; updated the relevant component documentation and development rules.
- Verification passed: `git diff --check`, `npm test` (127/127), `npm run test:multiple-choice`, `npm run test:tts`, `npm run typecheck`, `npm run lint`, production build, and browser route smoke test.

## 2026-07-16 18:39

- Completed the reusable Word Search Learning Window (Phase 1) on branch `feature/word-search-claude`, registered as `word-search` and exposed only through the playground: deterministic temporary `generateWordList()` boundary, straight-line selection in six directions via mouse drag, tap-first/tap-last taps, and a keyboard-only path, faint selection lines, persistent found-word highlighting, crossed-out word list, neutral incorrect feedback, duplicate prevention, and a Next button locked until every word is found
- Kept the Learning Engine subject-neutral: the only shared change is the two-line `word-search` registry registration; completion emits the established `submitAnswer` action with `{ complete, foundWords }` and Next emits `next`
- Post-audit hardening: selection matching now checks unfound words first and prefers exact forward matches, so reversed pairs such as STAR and RATS both complete in either order, and a documented two-letter minimum word length prevents unfindable single-letter words from soft-locking completion
- Added validation-boundary, generator, interaction state-machine, load-staleness, and SSR window-state tests plus a real-browser playground e2e covering mouse drag, keyboard, and touch selection; documented the window in `docs/components/WordSearchWindow.md`
- Verification passed: `npm test` (183/183), `npm run typecheck`, `npm run lint`, `npm run test:multiple-choice` (9/9), `npm run test:tts` (64/64), `npm run build`, `git diff --check`, and both e2e tests (vocabulary route and word-search playground)
