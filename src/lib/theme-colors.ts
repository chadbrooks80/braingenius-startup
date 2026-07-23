/**
 * Central color-token system for components that accept color props.
 *
 * COLOR_TOKENS is the ONLY place new semantic color names get added.
 * Components take a token (e.g. "feature") and resolve it to a Tailwind
 * class via getColorClass(token, kind) — never a raw CSS string.
 *
 * Every class string below must stay a full literal (no template
 * concatenation) so Tailwind's scanner can generate it.
 */

export const COLOR_TOKENS = [
  // Final semantic tokens — the 15-token BrainGenius theme
  "primary",
  "secondary",
  "primary-strong",
  "secondary-strong",
  "heading",
  "text",
  "muted",
  "background",
  "surface",
  "danger",
  "feature",
  "highlight",
  "warning",
  "success",
  "energy",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

export const COLOR_CLASS_MAP = {
  /* Solid backgrounds (cards, badges) */
  bg: {
    primary: "bg-primary",
    secondary: "bg-secondary",
    surface: "bg-surface",
    heading: "bg-heading",
    background: "bg-background",
    feature: "bg-feature",
    highlight: "bg-highlight",
    warning: "bg-warning",
    success: "bg-success",
  },
  /* Text and icon foregrounds */
  text: {
    primary: "text-primary",
    secondary: "text-secondary",
    surface: "text-surface",
    heading: "text-heading",
    feature: "text-feature",
    highlight: "text-highlight",
    warning: "text-warning",
    success: "text-success",
    text: "text-text",
  },
  /* Secondary text at --alpha-surface-soft (48%) (e.g. TestimonialCard role line) */
  textMuted: {
    surface: "text-surface/(--alpha-surface-soft)",
    heading: "text-heading/(--alpha-surface-soft)",
    text: "text-text/(--alpha-surface-soft)",
  },
  /* Tinted icon backgrounds at --alpha-subtle (13%) */
  iconBg: {
    primary: "bg-primary/(--alpha-subtle)",
    secondary: "bg-secondary/(--alpha-subtle)",
    surface: "bg-surface/(--alpha-subtle)",
    feature: "bg-feature/(--alpha-subtle)",
    highlight: "bg-highlight/(--alpha-subtle)",
    warning: "bg-warning/(--alpha-subtle)",
    success: "bg-success/(--alpha-subtle)",
  },
  /* FeatureCard accent border + hover glow: sets the CSS vars its
     hover:border/hover:shadow classes consume (glow = color at 20%) */
  border: {
    primary:
      "[--card-border:var(--color-primary)] [--card-glow:color-mix(in_srgb,var(--color-primary)_var(--alpha-soft),transparent)]",
    secondary:
      "[--card-border:var(--color-secondary)] [--card-glow:color-mix(in_srgb,var(--color-secondary)_var(--alpha-soft),transparent)]",
    feature:
      "[--card-border:var(--color-feature)] [--card-glow:color-mix(in_srgb,var(--color-feature)_var(--alpha-soft),transparent)]",
    highlight:
      "[--card-border:var(--color-highlight)] [--card-glow:color-mix(in_srgb,var(--color-highlight)_var(--alpha-soft),transparent)]",
    warning:
      "[--card-border:var(--color-warning)] [--card-glow:color-mix(in_srgb,var(--color-warning)_var(--alpha-soft),transparent)]",
    success:
      "[--card-border:var(--color-success)] [--card-glow:color-mix(in_srgb,var(--color-success)_var(--alpha-soft),transparent)]",
  },
  /* Pill backgrounds at --alpha-subtle (13%) (Eyebrow) */
  tintBg: {
    primary: "bg-primary/(--alpha-subtle)",
    secondary: "bg-secondary/(--alpha-subtle)",
    feature: "bg-feature/(--alpha-subtle)",
    highlight: "bg-highlight/(--alpha-subtle)",
    warning: "bg-warning/(--alpha-subtle)",
  },
  /* Pill borders at --alpha-medium (34%) (Eyebrow, keyed by its text color) */
  tintBorder: {
    primary: "border-primary/(--alpha-medium)",
    heading: "border-heading/(--alpha-medium)",
    text: "border-text/(--alpha-medium)",
    feature: "border-feature/(--alpha-medium)",
    highlight: "border-highlight/(--alpha-medium)",
    warning: "border-warning/(--alpha-medium)",
  },
} as const satisfies Record<string, Partial<Record<ColorToken, string>>>;

export type ColorKind = keyof typeof COLOR_CLASS_MAP;

export function getColorClass(token: ColorToken, kind: ColorKind): string {
  const cls = (COLOR_CLASS_MAP[kind] as Partial<Record<ColorToken, string>>)[
    token
  ];
  if (!cls) {
    throw new Error(
      `theme-colors: no "${kind}" class defined for color token "${token}". ` +
        `Add the combination to COLOR_CLASS_MAP in src/lib/theme-colors.ts.`
    );
  }
  return cls;
}
