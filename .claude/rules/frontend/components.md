---
paths:
  - "src/components/**/*"
  - "src/app/(app)/**/*"
  - "src/app/(auth)/**/*"
  - "src/app/(website)/**/*"
  - "src/app/auth/**/*"
  - "src/app/playground/**/*"
  - "src/app/le-playground/**/*"
  - "src/app/layout.tsx"
  - "src/learning-modules/**/components/**/*"
  - "src/learning-modules/**/screens/**/*"
---

# Components

## Placement and Reuse

- Inspect the nearest comparable component before creating or changing one.
- Reuse an existing component or extend its typed contract when it already represents the required UI.
- Place reusable primitives in `src/components/ui/`.
- Place reusable website sections and composed marketing elements in `src/components/blocks/`.
- Place application layout components in `src/components/layout/`.
- Place onboarding-specific components in `src/components/onboarding/`.
- Place shared learning layout and Learning Windows in `src/components/learning-engine/`.
- Place subject-specific visual content inside the owning learning module.
- Do not create a second component with the same responsibility under a different name or folder.

## Public Contracts

- Define an explicit prop type for every component.
- Prefer typed semantic props such as `variant`, `size`, `tone`, and approved color tokens over raw visual class strings.
- A reusable component's visual identity must be controlled by its own typed API.
- A `className` escape hatch may be used for caller-owned layout integration such as width, margin, alignment, or grid placement.
- Do not use `className` to bypass a component's approved colors, variants, interaction states, typography, or accessibility behavior.
- Do not accept raw CSS colors, arbitrary Tailwind color classes, or untyped configuration objects.
- Preserve backward-compatible public props unless the requested change explicitly includes a contract migration.

## Responsibilities

- Keep one coherent responsibility per component.
- Keep domain, progression, database, provider, and authoritative validation logic outside presentational components.
- Keep temporary interaction state local when no shared owner needs it.
- Do not copy server data into additional client state without a demonstrated need.
- Extract reusable logic only when it is genuinely shared or when separating it clarifies a meaningful boundary.
- Do not create abstraction layers for a single trivial use.

## Client and Server Boundaries

- Keep components as Server Components unless they need client behavior.
- Put `"use client"` at the narrowest practical boundary.
- Never import server-only modules, credentials, Prisma, answer keys, or provider implementations into a Client Component.
- Pass only the minimum client-safe data needed to render and interact.

## Interaction and Accessibility

- Use semantic HTML before ARIA.
- Every interactive control must be keyboard reachable and have an accessible name.
- Preserve visible focus, disabled, loading, success, error, and selected states.
- Prevent duplicate submissions while an action is pending.
- Images require meaningful alternative text unless they are decorative.
- Do not make essential instructions available only through color, hover, animation, or sound.
- Respect reduced-motion preferences for nonessential animation.

## Documentation

- Update existing component documentation when public props, variants, action IDs, accessibility behavior, or ownership changes.
- Create documentation for important shared components whose public contract is not obvious from normal TypeScript usage.
- Do not create duplicate documentation for a one-off internal composition with no reusable public contract.
- Documentation must describe current behavior rather than planned behavior.

## Verification

- Verify every supported variant and interaction state affected by the change.
- Check keyboard behavior and accessible names.
- Check responsive behavior at the component's relevant breakpoints.
- Confirm callers use semantic props rather than overriding the component's visual contract.
