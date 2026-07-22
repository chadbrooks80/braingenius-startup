/**
 * Central color-token system for components that accept color props.
 *
 * COLOR_TOKENS is the ONLY place new semantic color names get added.
 * Components take a token (e.g. "indigo") and resolve it to a Tailwind
 * class via getColorClass(token, kind) — never a raw CSS string.
 *
 * Every class string below must stay a full literal (no template
 * concatenation) so Tailwind's scanner can generate it.
 */

export const COLOR_TOKENS = [
  "primary",
  "secondary",
  "cyan",
  "lime",
  "indigo",
  "pink",
  "amber",
  "teal",
  "teal-green",
  "white",
  "dark",
  "bg-top",
  "text-primary",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

export const COLOR_CLASS_MAP = {
  /* Solid backgrounds (cards, badges) */
  bg: {
    primary: "bg-primary-cyan",
    secondary: "bg-secondary-lime",
    cyan: "bg-accent-cyan",
    lime: "bg-accent-lime",
    indigo: "bg-accent-indigo",
    pink: "bg-accent-pink",
    amber: "bg-accent-amber",
    teal: "bg-accent-teal",
    white: "bg-white",
    dark: "bg-dark",
    "bg-top": "bg-bg-top",
  },
  /* Text and icon foregrounds */
  text: {
    primary: "text-primary-cyan",
    secondary: "text-secondary-lime",
    cyan: "text-accent-cyan",
    lime: "text-accent-lime",
    indigo: "text-accent-indigo",
    pink: "text-accent-pink",
    amber: "text-accent-amber",
    teal: "text-accent-teal",
    white: "text-white",
    dark: "text-dark",
    "text-primary": "text-text-primary",
  },
  /* Secondary text at 60% (e.g. TestimonialCard role line) */
  textMuted: {
    white: "text-white/60",
    dark: "text-dark/60",
    "text-primary": "text-text-primary/60",
  },
  /* Tinted icon backgrounds at --alpha-subtle (13%) */
  iconBg: {
    primary: "bg-primary-cyan/13",
    cyan: "bg-accent-cyan/13",
    lime: "bg-accent-lime/13",
    indigo: "bg-accent-indigo/13",
    pink: "bg-accent-pink/13",
    amber: "bg-accent-amber/13",
    teal: "bg-accent-teal/13",
    white: "bg-white/13",
    "teal-green": "bg-icon-bg-teal-green",
  },
  /* FeatureCard accent border + hover glow: sets the CSS vars its
     hover:border/hover:shadow classes consume (glow = color at 25%) */
  border: {
    cyan: "[--card-border:var(--color-accent-cyan)] [--card-glow:color-mix(in_srgb,var(--color-accent-cyan)_25%,transparent)]",
    lime: "[--card-border:var(--color-accent-lime)] [--card-glow:color-mix(in_srgb,var(--color-accent-lime)_25%,transparent)]",
    indigo:
      "[--card-border:var(--color-accent-indigo)] [--card-glow:color-mix(in_srgb,var(--color-accent-indigo)_25%,transparent)]",
    pink: "[--card-border:var(--color-accent-pink)] [--card-glow:color-mix(in_srgb,var(--color-accent-pink)_25%,transparent)]",
    amber:
      "[--card-border:var(--color-accent-amber)] [--card-glow:color-mix(in_srgb,var(--color-accent-amber)_25%,transparent)]",
    teal: "[--card-border:var(--color-accent-teal)] [--card-glow:color-mix(in_srgb,var(--color-accent-teal)_25%,transparent)]",
  },
  /* Pill backgrounds at 15% (Eyebrow) */
  tintBg: {
    primary: "bg-primary-cyan/15",
    cyan: "bg-accent-cyan/15",
    lime: "bg-accent-lime/15",
    indigo: "bg-accent-indigo/15",
    pink: "bg-accent-pink/15",
    amber: "bg-accent-amber/15",
  },
  /* Pill borders at 40% (Eyebrow, keyed by its text color) */
  tintBorder: {
    dark: "border-dark/40",
    indigo: "border-accent-indigo/40",
    pink: "border-accent-pink/40",
    cyan: "border-accent-cyan/40",
    amber: "border-accent-amber/40",
    "text-primary": "border-text-primary/40",
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
