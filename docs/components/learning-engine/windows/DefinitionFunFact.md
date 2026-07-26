# DefinitionFunFact

Source: `src/components/learning-engine/windows/DefinitionFunFact/DefinitionFunFact.tsx`

## Registry and ownership

Registry key: `definition-fun-fact`. Client teaching window for a public module-provided fact.

## Props

| Prop | Type | Required |
| --- | --- | --- |
| `eyebrow` | `string` | Yes |
| `title` | `string` | Yes |
| `introLabel` | `string` | Yes |
| `body` | `string` | Yes |
| `onAction` | `OnAction` | Yes |

No defaults.

## Structure, behavior, and actions

Renders eyebrow, title, gradient fact card, and Next. Next emits `onAction("next")`. Declarative automatic speech is attached by the Vocabulary screen request, not this component. There is no state, pending/retry behavior, attempt identity, or reset logic.

## Accessibility and interaction

Next is a native button. All content is visible text; no essential information depends on speech or color.

## Security boundary

The active fact is an intentional teaching projection. The window does not grade, select progression, or read protected data.

## Consumers, playground, and tests

Created by `definitionFunFactScreen.ts`, registered centrally, and shown in `/le-playground`. Learning Engine flow tests prove screen-builder props and declarative speech.

## Usage

```tsx
<DefinitionFunFact
  eyebrow="Fun fact"
  title="adapt"
  introLabel="Did you know?"
  body="Adapt can describe changing a plan."
  onAction={onAction}
/>
```
