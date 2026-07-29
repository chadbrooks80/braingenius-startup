# SpeechPlaybackFailureBanner

Source: `src/components/learning-engine/SpeechPlaybackFailureBanner.tsx`

## Purpose and boundary

Client component that renders the one engine-wide learner notification for an active shared speech playback failure. The catch-all learning route is its only consumer. Modules and Learning Windows do not import it or implement their own speech-failure message, state, classification, or timer.

The component receives only a numeric request ID and never receives the controller's diagnostic stage, HTTP status, browser error name, media code, spoken text, protected reference, response data, endpoint, or provider details.

## Props

| Prop | Type | Required | Meaning |
| --- | --- | --- | --- |
| `requestId` | `number` | Yes | Identifies the current route-owned notice and its timer lifetime. |
| `onDismiss` | `(requestId: number) => void` | Yes | Requests dismissal of that exact notice occurrence. |

`SPEECH_FAILURE_AUTO_DISMISS_MS` is a fixed exported constant equal to `12_000`; production callers cannot configure the timeout.

## Structure and behavior

The banner renders the fixed learner-safe message exactly once:

> Audio couldn't play. Please try again.

One lucide-react `X` button calls `onDismiss(requestId)` immediately. Its accessible name is `Dismiss audio error`.

On mount or request-ID replacement, one effect starts a 12-second timer. The effect clears its timer on unmount or replacement and calls `onDismiss` with the same request ID on expiry. A newer notice therefore gets a fresh lifetime. The owning route performs a functional request-ID comparison before clearing state, so an old timer or old X callback cannot dismiss a newer notice. A successful retry clears the route notice through the shared speech bridge.

The component moves no focus, traps no focus, and has no entrance or exit animation.

## Styling and accessibility

The root is a single `role="alert"` live region with `aria-atomic="true"`. It uses text plus the close control rather than color alone. The X is a native keyboard-operable button with a visible `focus-visible` ring.

Styling uses only existing semantic theme utilities and shared opacity, radius, transition, spacing, and focus tokens. There are no inline styles, hardcoded/default Tailwind colors, new theme tokens, or animation.

## Consumers and tests

`src/app/(app)/(learning)/learning/[...learning]/page.tsx` renders the component once above the learning header/content whenever the route-owned notice is non-null.

`tests/components/speechPlaybackFailureBanner.test.tsx` uses static React rendering to prove the exact copy, alert semantics, accessible button, privacy boundary, lack of inline style, and fixed timeout constant. Static rendering cannot execute effects, timer cleanup, clicks, touch, or focus.

`tests/e2e/speechPlaybackFailure.e2e.ts` uses the real production learning route and locally intercepted speech responses to prove immediate keyboard/touch dismissal, visible keyboard focus, one-notice replacement, fresh 12-second lifetimes, old-timer protection, successful retry, same-screen replacement, screen-change cancellation, responsive placement, and absence of page errors without contacting a paid provider.
