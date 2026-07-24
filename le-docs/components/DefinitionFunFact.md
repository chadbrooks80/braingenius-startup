# DefinitionFunFact

Reusable fact/detail window registered as `"definition-fun-fact"`.

The active module supplies the eyebrow, title, introductory label, and body. The component only renders that content and emits `next`; it contains no subject or progression decisions. Vocabulary uses it for word facts, while another module can use the same presentation for a science, reading, or math fact.

The vocabulary screen factory continues to use `ScreenRequest.speak` to read its module-owned fact automatically.

Sources: `src/components/learning-engine/windows/DefinitionFunFact/` and `src/learning-modules/vocabulary/screens/definitionFunFactScreen.ts`.
