# Theme and Styling

## Canonical configuration

`src/app/globals.css` is the sole Tailwind CSS v4 and application theme entrypoint. It imports `tailwindcss`, defines tokens with `@theme`/`@theme inline`, and owns global body and `.learning-shell` behavior. There is no `tailwind.config.*`.

The 15 literal base colors are `primary`, `secondary`, `primary-strong`, `secondary-strong`, `heading`, `text`, `muted`, `background`, `surface`, `danger`, `feature`, `highlight`, `warning`, `success`, and `energy`. Job aliases are `link`, `success-text`, `focus`, and `on-dark`. Components use semantic utilities, not literal colors or Tailwind default palettes.

The shared opacity scale is `hairline`, `subtle`, `soft`, `medium`, `surface-soft`, `surface`, and `surface-strong`. The same file exposes typography, radius, shadow, layout, blur, and transition tokens. Global animations are `bob`, `progressFill`, and the IntersectionObserver-driven `.reveal-item` transition.

## Typed configurable colors

`src/lib/theme-colors.ts` owns:

- `COLOR_TOKENS`: the complete 15-token union;
- `ColorKind`: `bg`, `text`, `textMuted`, `iconBg`, `border`, `tintBg`, or `tintBorder`;
- `ColorTokenFor<K>`: only tokens with a class for kind `K`;
- `COLOR_CLASS_MAP`: complete literal Tailwind strings;
- per-kind `getColorClass(token, kind)` overloads.

Supported token categories:

| Kind | Tokens |
| --- | --- |
| `bg` | `primary`, `secondary`, `surface`, `heading`, `background`, `feature`, `highlight`, `warning`, `success` |
| `text` | `primary`, `secondary`, `surface`, `heading`, `feature`, `highlight`, `warning`, `success`, `text` |
| `textMuted` | `surface`, `heading`, `text` |
| `iconBg` | `primary`, `secondary`, `surface`, `feature`, `highlight`, `warning`, `success` |
| `border` | `primary`, `secondary`, `feature`, `highlight`, `warning`, `success` |
| `tintBg` | `primary`, `secondary`, `feature`, `highlight`, `warning` |
| `tintBorder` | `primary`, `heading`, `text`, `feature`, `highlight`, `warning` |

`border` recipes set `--card-border` and `--card-glow`; this is the approved dynamic-token pattern because all classes remain statically discoverable. `src/lib/theme-colors.type-check.ts` proves valid and invalid combinations during `npx tsc --noEmit`.

## Component styling contracts

Reusable components expose typed variants or color-token props. `className` is a caller layout escape hatch, not permission to replace a component's color, state, type, or accessibility recipe. `Button`, `Input`, and `LearningWindowShell` keep complete variant recipes in their source. See individual component docs for exact contracts.

Applicable rules are `.claude/rules/frontend/theme.md`, `.claude/rules/frontend/globals-css.md`, and `.claude/rules/frontend/components.md`.
