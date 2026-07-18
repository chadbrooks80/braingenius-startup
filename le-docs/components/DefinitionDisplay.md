# DefinitionDisplay

Reusable two-section concept-introduction window registered as `"definition-display"`.

The active module supplies the eyebrow, title, section labels and content, replay label/text, and TTS configuration. The window filters blank secondary items, emits the generic engine `speak` action for replay, and emits `next` for progression. It contains no vocabulary progression or wording decisions.

The vocabulary screen factory uses this contract for a word, its definition, and three examples. Other subjects can provide their own concept title and supporting material without changing the window.

Sources: `src/components/LearningWindows/DefinitionDisplay/` and `src/learning-modules/vocabulary/screens/definitionDisplayScreen.ts`.
