---
paths:
  - "src/app/globals.css"
---

# Global CSS

## Ownership

- `src/app/globals.css` is the single application-wide Tailwind CSS v4 and Brain Genius theme entrypoint.
- Do not create another global stylesheet, nested Learning Engine theme, or JavaScript Tailwind configuration.
- Preserve `@import "tailwindcss"` and CSS-based `@theme` configuration.

## Theme Sections

Keep the file organized around these responsibilities:

1. Canonical base colors.
2. Semantic color aliases.
3. Shared opacity scale.
4. Shared non-color tokens.
5. Tailwind-exposed non-color utilities.
6. Truly global behavior, keyframes, and application shells.

- The 15 base colors are the only approved literal application colors.
- Semantic aliases must point to existing base colors; an alias must not introduce another literal color.
- Shared opacity values must remain centralized.
- Raw shadow colors are allowed only inside the centralized shadow-token definitions.
- Do not duplicate a token under an old or feature-specific name to avoid updating consumers.

## Changing Tokens

- Before renaming or deleting any token, search every CSS, TypeScript, TSX, documentation, and test reference.
- Classify consumers and migrate them in the same approved change.
- Keep `src/lib/theme-colors.ts` and `src/lib/theme-colors.type-check.ts` synchronized with supported semantic color behavior.
- Do not retain temporary aliases after all consumers have migrated unless a documented compatibility boundary still needs them.
- Do not change a shared token to fix one component when that change would unintentionally alter other consumers.
- Adding or materially changing a base color, opacity, shared shadow, radius, typography token, or global shell requires explicit theme scope.

## Global Behavior

- Global selectors are for true application-wide behavior. Component-specific styling belongs with the component through Tailwind classes and shared tokens.
- Shared keyframes may live here when multiple components or global utility classes use them.
- Preserve the website `body` background behavior and the solid `.learning-shell` behavior unless the requested work explicitly changes those surfaces.
- Do not add broad element selectors that unexpectedly restyle reusable components or third-party content.
- Avoid `!important`. If specificity appears to require it, identify and fix the ownership problem first.

## Tailwind CSS v4

- Use `@theme` and `@theme inline` correctly for Tailwind-exposed tokens.
- Do not create `tailwind.config.js`, `tailwind.config.ts`, or JavaScript-generated utility lists.
- Keep utility-producing values statically discoverable by Tailwind.
- Do not copy Tailwind v3 configuration patterns into this project.

## Verification

- Search the repository before and after token changes.
- Confirm no consumer still references a removed or renamed token.
- Run the repository's available type, lint, and build checks relevant to CSS generation.
- Visually verify both the public website and the Learning Engine when a shared token or global selector changes.
