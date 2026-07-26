# AnswerRecapWindow

Source: `src/components/learning-engine/windows/AnswerRecap/AnswerRecapWindow.tsx`

## Registry and ownership

Registry key: `answer-recap`. Client Learning Window for presenting intentionally public post-grade recap content and emitting generic actions. Vocabulary creates its current props; the engine owns feedback/speech/screen transitions.

## Props

| Prop | Type | Required |
| --- | --- | --- |
| `label`, `title`, `primaryText`, `secondaryText` | `string` | Yes |
| `replayLabel`, `playingMessage`, `completeMessage` | `string` | Yes |
| `speechText` | `string[]` | Yes |
| `tts` | `TtsConfiguration` | Yes |
| `isSpeaking` | `boolean` | Yes |
| `onAction` | `OnAction` | Yes |

No defaults.

## Structure, behavior, and actions

Renders label/title, replay button, primary/secondary recap, speech status, and Next. Replay emits `onAction("speak", { text: speechText, tts })`. Next emits `onAction("next")`; it is disabled while `isSpeaking`. Replay itself remains enabled. There is no local state or attempt identity; a screen replacement/remount resets only normal React state (none).

## Accessibility and interaction

Replay is a native button named by `replayLabel`; Next is a native button. Status text changes with `isSpeaking` but is not live. Keyboard support is native button activation. No pointer/touch-specific behavior.

## Security boundary

This screen appears only after a confirmed grade, so the module may intentionally expose word, definition, and example text. The window does not grade or resolve protected content.

## Consumers, playground, and tests

Created by `answerRecapScreen.ts`, registered by `LearningWindowRegistry`, and shown in `/le-playground`. `tests/learning-engine/vocabularyWindowFlow.test.tsx` proves speech props, Next gating during playback, and neutral completion output.

## Usage

```tsx
<AnswerRecapWindow
  label="Answer recap"
  title="term"
  primaryText="definition"
  secondaryText="example"
  replayLabel="Hear recap"
  playingMessage="Playing…"
  completeMessage="Complete"
  speechText={["term", "definition"]}
  tts={tts}
  isSpeaking={false}
  onAction={onAction}
/>
```
