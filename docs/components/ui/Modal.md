# Modal

Source: `src/components/ui/Modal.tsx`

## Purpose and boundary

Client overlay container with backdrop/close-button dismissal. The client boundary is required for document key handling and click events.

## Props

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `open` | `boolean` | Yes | — |
| `onClose` | `() => void` | Yes | — |
| `title` | `string` | No | — |
| `children` | `ReactNode` | Yes | — |

## Structure and behavior

When closed, returns `null`. When open, adds a document `keydown` listener and calls `onClose` for Escape; cleanup removes it. Clicking the backdrop closes, while card clicks stop propagation. Header renders optional title and always a Close button.

## Styling and accessibility

Uses a fixed semantic backdrop and surface card. Close has `aria-label="Close"`. The container does not currently set `role="dialog"`, `aria-modal`, or title association; it does not trap/restore focus or lock body scrolling.

## Consumers and tests

Used by `ChildrenStep`. No focused test exists.

## Usage

```tsx
<Modal open={open} onClose={() => setOpen(false)} title="Edit">
  Content
</Modal>
```
