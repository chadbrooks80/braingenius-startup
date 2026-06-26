# Modal

**Path:** `src/components/ui/Modal.tsx`

A simple controlled modal with a backdrop, close button, and optional title. Closes on backdrop click or Escape key.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Whether the modal is visible |
| `onClose` | `() => void` | — | Called on backdrop click, close button, or Escape |
| `title` | `string` | — | Optional heading shown in the modal header |
| `children` | `ReactNode` | — | Modal body content |

## Usage

```tsx
<Modal open={activeSlot !== null} onClose={() => setActiveSlot(null)} title="Add Child">
  <AddChildForm />
</Modal>
```
