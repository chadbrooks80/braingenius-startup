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
  // Migration-only aliases — old Host/Learning Engine names still passed by
  // unconverted callers. Remove once repository usage reaches zero.
  "cyan",
  "lime",
  "indigo",
  "teal-green",
  "dark",
  "bg-top",
  "text-primary",
  "white",
  "pink",
  "amber",
  "teal",
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
    // Migration-only aliases
    cyan: "bg-primary",
    lime: "bg-secondary",
    indigo: "bg-feature",
    pink: "bg-highlight",
    amber: "bg-warning",
    teal: "bg-success",
    white: "bg-surface",
    dark: "bg-heading",
    "bg-top": "bg-background",
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
    // Migration-only aliases
    cyan: "text-primary",
    lime: "text-secondary",
    indigo: "text-feature",
    pink: "text-highlight",
    amber: "text-warning",
    teal: "text-success",
    white: "text-surface",
    dark: "text-heading",
    "text-primary": "text-text",
  },
  /* Secondary text at --alpha-surface-soft (48%) (e.g. TestimonialCard role line) */
  textMuted: {
    surface: "text-surface/48",
    heading: "text-heading/48",
    text: "text-text/48",
    // Migration-only aliases
    white: "text-surface/48",
    dark: "text-heading/48",
    "text-primary": "text-text/48",
  },
  /* Tinted icon backgrounds at --alpha-subtle (13%) */
  iconBg: {
    primary: "bg-primary/13",
    secondary: "bg-secondary/13",
    surface: "bg-surface/13",
    feature: "bg-feature/13",
    highlight: "bg-highlight/13",
    warning: "bg-warning/13",
    success: "bg-success/13",
    // Migration-only aliases
    cyan: "bg-primary/13",
    lime: "bg-secondary/13",
    indigo: "bg-feature/13",
    pink: "bg-highlight/13",
    amber: "bg-warning/13",
    teal: "bg-success/13",
    "teal-green": "bg-success/13",
    white: "bg-surface/13",
  },
  /* FeatureCard accent border + hover glow: sets the CSS vars its
     hover:border/hover:shadow classes consume (glow = color at 20%) */
  border: {
    primary:
      "[--card-border:var(--color-primary)] [--card-glow:color-mix(in_srgb,var(--color-primary)_20%,transparent)]",
    secondary:
      "[--card-border:var(--color-secondary)] [--card-glow:color-mix(in_srgb,var(--color-secondary)_20%,transparent)]",
    feature:
      "[--card-border:var(--color-feature)] [--card-glow:color-mix(in_srgb,var(--color-feature)_20%,transparent)]",
    highlight:
      "[--card-border:var(--color-highlight)] [--card-glow:color-mix(in_srgb,var(--color-highlight)_20%,transparent)]",
    warning:
      "[--card-border:var(--color-warning)] [--card-glow:color-mix(in_srgb,var(--color-warning)_20%,transparent)]",
    success:
      "[--card-border:var(--color-success)] [--card-glow:color-mix(in_srgb,var(--color-success)_20%,transparent)]",
    // Migration-only aliases
    cyan: "[--card-border:var(--color-primary)] [--card-glow:color-mix(in_srgb,var(--color-primary)_20%,transparent)]",
    lime: "[--card-border:var(--color-secondary)] [--card-glow:color-mix(in_srgb,var(--color-secondary)_20%,transparent)]",
    indigo:
      "[--card-border:var(--color-feature)] [--card-glow:color-mix(in_srgb,var(--color-feature)_20%,transparent)]",
    pink: "[--card-border:var(--color-highlight)] [--card-glow:color-mix(in_srgb,var(--color-highlight)_20%,transparent)]",
    amber:
      "[--card-border:var(--color-warning)] [--card-glow:color-mix(in_srgb,var(--color-warning)_20%,transparent)]",
    teal: "[--card-border:var(--color-success)] [--card-glow:color-mix(in_srgb,var(--color-success)_20%,transparent)]",
  },
  /* Pill backgrounds at --alpha-subtle (13%) (Eyebrow) */
  tintBg: {
    primary: "bg-primary/13",
    secondary: "bg-secondary/13",
    feature: "bg-feature/13",
    highlight: "bg-highlight/13",
    warning: "bg-warning/13",
    // Migration-only aliases
    cyan: "bg-primary/13",
    lime: "bg-secondary/13",
    indigo: "bg-feature/13",
    pink: "bg-highlight/13",
    amber: "bg-warning/13",
  },
  /* Pill borders at --alpha-medium (34%) (Eyebrow, keyed by its text color) */
  tintBorder: {
    primary: "border-primary/34",
    heading: "border-heading/34",
    text: "border-text/34",
    feature: "border-feature/34",
    highlight: "border-highlight/34",
    warning: "border-warning/34",
    // Migration-only aliases
    dark: "border-heading/34",
    indigo: "border-feature/34",
    pink: "border-highlight/34",
    cyan: "border-primary/34",
    amber: "border-warning/34",
    "text-primary": "border-text/34",
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
