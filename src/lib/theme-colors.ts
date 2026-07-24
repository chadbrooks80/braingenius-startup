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
  /* Secondary text (e.g. TestimonialCard role line). "surface" stays translucent
     white for use on dark cards, where it remains readable; "text" and "heading"
     use the full-opacity muted color since their faded form falls below the
     4.5:1 contrast minimum on light surfaces. */
  textMuted: {
    surface: "text-surface/(--alpha-surface-soft)",
    heading: "text-muted",
    text: "text-muted",
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

/**
 * The literal token union actually defined for a given color kind (e.g.
 * ColorTokenFor<"tintBorder"> excludes tokens that have no tintBorder class),
 * so callers can narrow their props to only the combinations that compile.
 */
export type ColorTokenFor<K extends ColorKind> = keyof (typeof COLOR_CLASS_MAP)[K];

/**
 * A `(token, kind)` pair for a single, concrete `K`. Distributing the mapped
 * type over `ColorKind` (rather than writing `[ColorTokenFor<K>, K]` once for
 * a generic `K`) keeps each branch's token type tied to its own kind, so the
 * switch below narrows `token` purely from narrowing `kind` — no cast needed.
 */
type ColorClassArgs = {
  [K in ColorKind]: [token: ColorTokenFor<K>, kind: K];
}[ColorKind];

/**
 * One overload per color kind (rather than a single generic declaration)
 * keeps every call site checked against `ColorTokenFor<K>` for its literal
 * `kind`, while giving the implementation below a concrete union
 * (`ColorClassArgs`) it can narrow via `switch` — no cast needed to prove
 * the lookup is a string.
 */
export function getColorClass(token: ColorTokenFor<"bg">, kind: "bg"): string;
export function getColorClass(token: ColorTokenFor<"text">, kind: "text"): string;
export function getColorClass(token: ColorTokenFor<"textMuted">, kind: "textMuted"): string;
export function getColorClass(token: ColorTokenFor<"iconBg">, kind: "iconBg"): string;
export function getColorClass(token: ColorTokenFor<"border">, kind: "border"): string;
export function getColorClass(token: ColorTokenFor<"tintBg">, kind: "tintBg"): string;
export function getColorClass(token: ColorTokenFor<"tintBorder">, kind: "tintBorder"): string;
export function getColorClass(...[token, kind]: ColorClassArgs): string {
  switch (kind) {
    case "bg":
      return colorClassOrThrow(COLOR_CLASS_MAP.bg[token], token, kind);
    case "text":
      return colorClassOrThrow(COLOR_CLASS_MAP.text[token], token, kind);
    case "textMuted":
      return colorClassOrThrow(COLOR_CLASS_MAP.textMuted[token], token, kind);
    case "iconBg":
      return colorClassOrThrow(COLOR_CLASS_MAP.iconBg[token], token, kind);
    case "border":
      return colorClassOrThrow(COLOR_CLASS_MAP.border[token], token, kind);
    case "tintBg":
      return colorClassOrThrow(COLOR_CLASS_MAP.tintBg[token], token, kind);
    case "tintBorder":
      return colorClassOrThrow(COLOR_CLASS_MAP.tintBorder[token], token, kind);
    default:
      return colorClassOrThrow(undefined, token, kind);
  }
}

function colorClassOrThrow(cls: string | undefined, token: unknown, kind: unknown): string {
  if (!cls) {
    throw new Error(
      `theme-colors: no "${String(kind)}" class defined for color token "${String(token)}". ` +
        `Add the combination to COLOR_CLASS_MAP in src/lib/theme-colors.ts.`
    );
  }
  return cls;
}
