# ExampleBlock

**Path:** `src/components/blocks/ExampleBlock.tsx`

A reusable card shell based on the `.quiz-card` design from the landing page. Provides a dark card with a labeled header and optional status badge. All inner content is passed as `children`.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Required. Uppercase muted text rendered on the left of the header |
| `status` | `string` | — | Optional. If provided, renders a pill badge on the right of the header |
| `statusColor` | `string` | `"--color-secondary-lime"` | CSS variable name for the badge background color |
| `children` | `ReactNode` | — | Content rendered inside the card body |

## Notes

- `status` is fully conditional — omitting it removes the badge entirely
- `statusColor` has no effect when `status` is not provided
- Pass CSS variable names without `var()`, e.g. `"--color-accent-indigo"` not `"var(--color-accent-indigo)"`
- No `className` prop — styling is controlled via props and theme variables only

## Usage

```tsx
// Label only
<ExampleBlock label="Vocabulary">
  <p>Placeholder content</p>
</ExampleBlock>

// With default lime status badge
<ExampleBlock label="Quiz" status="Live">
  <p>Placeholder content</p>
</ExampleBlock>

// With custom status color
<ExampleBlock label="Review" status="Pending" statusColor="--color-accent-indigo">
  <p>Placeholder content</p>
</ExampleBlock>
```
