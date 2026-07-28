# Modal

Source: `src/components/ui/Modal.tsx`

## Purpose and boundary

Client overlay container with backdrop/close-button dismissal. The client boundary is required for document key handling and click events.

## Props

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `open` | `boolean` | Yes | — |
| `onClose` | `() => void` | Yes | — |
| `title` | `string` | Yes | — |
| `children` | `ReactNode` | Yes | — |

`title` is required: it is always rendered and is the dialog's only accessible name, so a caller cannot omit it in favor of a separate `aria-label` contract.

## Structure and behavior

When closed, returns `null`. When open:

- the panel receives `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at a React-generated ID on the title `<h2>`;
- the previously focused element is remembered, and focus moves to the panel's first focusable descendant (the panel itself, via `tabIndex={-1}`, as a fallback);
- a document `keydown` listener calls `onClose` for Escape and traps `Tab`/`Shift+Tab` within the panel's focusable descendants, wrapping at the first/last;
- on close (Escape, backdrop click, close button, or a caller-driven `open` change such as a successful submission) or unmount, the listener is removed and focus is restored to the previously focused element.

The listener/focus effect keys only on `open` (via a ref for the latest `onClose`) so it runs exactly once per open/close transition, not on every render. Clicking the backdrop closes, while panel clicks stop propagation. Header renders the title and always a Close button.

## Styling and accessibility

Uses a fixed semantic backdrop and surface card. Close has `aria-label="Close"`. The container sets `role="dialog"`, `aria-modal="true"`, and a labelled title; it traps and restores focus. It does not lock body scrolling.

## Consumers and tests

Used by `ChildrenStep`. `tests/components/modalAccessibility.test.tsx` covers the statically verifiable contract (dialog role, `aria-modal`, title association, close-button name, panel focus fallback, and the required `title` prop) under this repository's `renderToStaticMarkup`-only component-test harness, since this harness has no DOM/jsdom to dispatch real focus or keyboard events and this feature may not add one. Initial focus, Tab/Shift+Tab wrapping, the Escape lifecycle, focus restoration, and listener cleanup across repeated open/close cycles are NOT covered by an automated test: a real browser keyboard check at the Children onboarding modal was not run because no authorized disposable authenticated test boundary was available. This is a known, reported limitation, not a passing check.

## Usage

```tsx
<Modal open={open} onClose={() => setOpen(false)} title="Edit">
  Content
</Modal>
```
