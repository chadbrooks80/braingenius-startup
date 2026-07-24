# LearningWindowShell

**Path:** `src/learning-engine-components/UI/LearningWindowShell.tsx`

A small presentational shell that renders the repeated Learning Window frame: a centered outer wrapper and an inner themed card. It holds no state or feature logic.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"standard" \| "wide"` | `"standard"` | `standard` is `max-w-lg`; `wide` is `max-w-2xl` |
| `align` | `"start" \| "center"` | `"start"` | `center` adds `text-center` for content-only windows (e.g. errors) |
| `backdrop` | `boolean` | `true` | Toggles the `backdrop-blur-(--blur-glass)` utility |
| `children` | `ReactNode` | — | Window content |

## Base recipe (always applied)

- Outer wrapper: `flex-1 flex items-center justify-center p-6`
- Inner card: `w-full rounded-3xl p-8 border border-surface/(--alpha-surface) bg-surface/(--alpha-surface-strong) shadow-[0_16px_56px] shadow-heading/(--alpha-subtle)`

## Usage

```tsx
<LearningWindowShell>
  {/* standard window content */}
</LearningWindowShell>

<LearningWindowShell align="center">
  {/* LearningErrorWindow */}
</LearningWindowShell>

<LearningWindowShell size="wide">
  {/* WordSearchWindow */}
</LearningWindowShell>

<LearningWindowShell backdrop={false}>
  {/* LessonCompleteWindow */}
</LearningWindowShell>
```

## Migrated windows

- `AnswerRecapWindow` — standard, backdrop
- `DefinitionDisplay` — standard, backdrop
- `DefinitionFunFact` — standard, backdrop
- `LearningErrorWindow` — standard, `align="center"`, backdrop
- `LessonCompleteWindow` — standard, `backdrop={false}`
- `MultipleChoiceWindow` — standard, backdrop
- `SpellingWindow` — standard, backdrop
- `WordSearchWindow` — `size="wide"`, backdrop

## Deliberate exception

`StartupWindow` is **not** migrated to this shell. Its 980px two-panel responsive grid layout is structurally different from the single-card recipe above, so forcing it into this shell would over-generalize the component. It keeps its own wrapper markup and only replaced its inline `backdropFilter: blur(12px)` with the theme-controlled `backdrop-blur-(--blur-glass)` utility class.
