# DefinitionDisplay

Source: `src/components/learning-engine/windows/DefinitionDisplay/DefinitionDisplay.tsx`

## Registry and ownership

Registry key: `definition-display`. Client teaching window for intentionally public word/definition/examples. The module owns content and progression; the window emits generic speech/next actions.

## Props

| Prop | Type | Required |
| --- | --- | --- |
| `eyebrow`, `title`, `primaryLabel`, `primaryText`, `secondaryLabel`, `replayLabel` | `string` | Yes |
| `secondaryItems` | `string[]` | Yes |
| `replayText` | `string | string[]` | Yes |
| `tts` | `TtsConfiguration` | Yes |
| `onAction` | `OnAction` | Yes |

No defaults.

## Structure, behavior, and actions

Blank/whitespace secondary items are filtered for display. Replay emits `onAction("speak", { text: replayText, tts })`; Next emits `onAction("next")`. No local state, pending lock, retry, completion, or attempt identity is present.

## Accessibility and interaction

Replay is a named native button and Next is a native button; both get keyboard/pointer support from HTML. Examples are paragraphs. Speech is supplementary rather than the only instruction.

## Security boundary

This is a teaching projection, so current-screen text is public. It must not be reused for preloading future graded answers. The window does not access module/server state.

## Consumers, playground, and tests

Created by `definitionDisplayScreen.ts`, registered centrally, and shown in `/le-playground`. `tests/learning-engine/vocabularyWindowFlow.test.tsx` proves the screen builder preserves public props and declarative speech.

## Usage

```tsx
<DefinitionDisplay
  eyebrow="New word"
  title="adapt"
  primaryLabel="Definition"
  primaryText="to adjust"
  secondaryLabel="Examples"
  secondaryItems={["Plants adapt."]}
  replayLabel="Hear pronunciation"
  replayText="adapt"
  tts={tts}
  onAction={onAction}
/>
```
