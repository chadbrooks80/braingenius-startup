---
paths:
  - "src/app/**/*.tsx"
  - "src/components/**/*.{ts,tsx}"
  - "src/learning-modules/**/components/**/*.{ts,tsx}"
  - "src/learning-modules/**/screens/**/*.{ts,tsx}"
  - "src/lib/theme-colors*.ts"
  - "src/app/globals.css"
---

# Theme and Styling

## Important!

- Never create a new theme, alternate palette, theme provider, or feature-specific theme.
- Never modify `src/app/globals.css` unless the user explicitly requests a global theme or global-style change.
- If the existing theme cannot support the requested design, stop and ask before changing it.


## Canonical Theme

- `src/app/globals.css` is the source of truth for Brain Genius theme tokens.
- The current theme contains 15 canonical base colors: `primary`, `secondary`, `primary-strong`, `secondary-strong`, `heading`, `text`, `muted`, `background`, `surface`, `danger`, `feature`, `highlight`, `warning`, `success`, and `energy`.
- Use colors according to their semantic purpose, not because a token happens to resemble the desired raw color.
- Do not add, rename, remove, or redefine a base color or semantic alias unless the requested work explicitly changes the theme and the user approves it.

## Color Rules

- Use only Brain Genius semantic theme utilities and approved semantic aliases.
- Do not use Tailwind default palette colors such as `red-500`, `slate-900`, `white`, or `black`.
- Do not add hexadecimal, RGB, RGBA, HSL, HSLA, OKLCH, named-color, or arbitrary color literals in components.
- Do not create component-local color variables or one-off color aliases.
- Raw color definitions belong only in the canonical base-color and approved shadow definitions in `src/app/globals.css`.
- Use `danger` for errors, `warning` for caution, and `success` for confirmed positive status. Do not substitute a decorative accent for a status meaning.
- Gradients must use semantic theme tokens.

### Google G Brand Exception

- The Google G in authentication controls is an approved third-party brand exception.
- Its four official literal path fills may appear only inside the Google logo SVG implementations.
- These colors must not become Brain Genius theme tokens, semantic aliases, reusable application colors, or styling for non-Google UI.
- This exception does not weaken the prohibition on raw colors for normal Brain Genius interface styling.

## Opacity and Effects

- Use the shared opacity scale from `src/app/globals.css`: `hairline`, `subtle`, `soft`, `medium`, `surface-soft`, `surface`, and `surface-strong`.
- Do not invent a one-off opacity when an existing shared level expresses the intended hierarchy.
- Use the shared radius, shadow, spacing, blur, typography, and transition tokens when an applicable token exists.
- Arbitrary non-color values are allowed for genuinely component-specific geometry or runtime interaction behavior. Repeated values should become an approved shared token.
- Inline `style` is allowed only for runtime-calculated, non-theme values that Tailwind cannot know statically, such as animation delay, measured position, progress width, or touch behavior.
- Never use inline styles to bypass theme colors, typography, radii, shadows, or reusable component variants.

## Configurable Component Colors

- Components with configurable colors must accept typed semantic tokens rather than raw class strings or CSS values.
- Resolve configurable color props through `getColorClass()` and `COLOR_CLASS_MAP` in `src/lib/theme-colors.ts`.
- Keep every Tailwind class in `COLOR_CLASS_MAP` as a complete literal string so Tailwind can detect it.
- When adding an approved token-and-kind combination, update the color map and the compile-time checks in `src/lib/theme-colors.type-check.ts`.
- Do not widen a component color prop to the full `ColorToken` union when the component supports only a smaller set of token kinds.

## Visual Consistency

- Reuse existing UI primitives, blocks, Learning Window shells, and theme recipes before creating an alternative.
- Follow the nearest comparable component's hierarchy, spacing, typography, interaction states, and responsive behavior.
- Preserve readable contrast in default, hover, focus, disabled, loading, selected, correct, incorrect, and error states.
- Do not encode information by color alone.
- Preserve visible keyboard focus and reduced-motion accessibility where animation is involved.

## Verification

- Search changed files for raw color literals and Tailwind default palette utilities.
- Verify configurable tokens compile through the existing type-check fixture.
- Check the affected UI at relevant viewport sizes when visual behavior changes.
- A visually acceptable result is not approved if it bypasses the semantic theme.
