# ScreenRenderer

Renders the active Learning Window and enforces ownership of transient engine state.

`ScreenRenderer` spreads module-supplied screen props first, then injects nullable, explicitly typed `answerFeedback` as the window’s `feedback` prop and injects `isSpeaking`. This ordering ensures live engine state wins if a module accidentally supplies conflicting properties. Feedback is reset on every screen change; the shared engine and renderer do not inspect which feedback variant the active module returned.

The component is layout plumbing, not a registered window, and is used only by the dynamic learning route. New engine-owned transient state should follow the same final-injection pattern.

Sources: `src/components/Blocks/ScreenRenderer.tsx`, `src/lib/learning-engine/screens/withSharedScreenProps.ts`, and `src/app/learning/[...learning]/page.tsx`.
