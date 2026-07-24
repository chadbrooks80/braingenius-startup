/**
 * Compile-time-only fixture for getColorClass()'s per-kind token typing.
 * Not imported anywhere at runtime; exists purely so `npx tsc --noEmit`
 * verifies both the allowed token/kind combinations compile and the
 * invalid ones are rejected.
 */
import { getColorClass, type ColorTokenFor } from "@/lib/theme-colors";

// Allowed combinations compile cleanly.
getColorClass("primary", "bg");
getColorClass("surface", "bg");
getColorClass("text", "text");
getColorClass("surface", "textMuted");
getColorClass("primary", "iconBg");
getColorClass("primary", "border");
getColorClass("primary", "tintBg");
getColorClass("heading", "tintBorder");

// @ts-expect-error "danger" has no "bg" class in COLOR_CLASS_MAP.
getColorClass("danger", "bg");

// @ts-expect-error "background" has no "text" class in COLOR_CLASS_MAP.
getColorClass("background", "text");

// @ts-expect-error "primary" has no "textMuted" class in COLOR_CLASS_MAP.
getColorClass("primary", "textMuted");

// @ts-expect-error "background" has no "iconBg" class in COLOR_CLASS_MAP.
getColorClass("background", "iconBg");

// @ts-expect-error "text" has no "border" class in COLOR_CLASS_MAP.
getColorClass("text", "border");

// @ts-expect-error "text" has no "tintBg" class in COLOR_CLASS_MAP.
getColorClass("text", "tintBg");

// @ts-expect-error "secondary" has no "tintBorder" class in COLOR_CLASS_MAP.
getColorClass("secondary", "tintBorder");

// @ts-expect-error a nonexistent color kind must be rejected.
getColorClass("primary", "notAKind");

// Consumers narrow multi-kind props to the intersection of both token sets
// (see Eyebrow's textColor, TestimonialCard's fontColor, FeatureSection's
// accentColor) — demonstrated here directly against ColorTokenFor.
type EyebrowTextColor = Extract<ColorTokenFor<"text">, ColorTokenFor<"tintBorder">>;
const validEyebrowTextColor: EyebrowTextColor = "heading";
void validEyebrowTextColor;

// @ts-expect-error "surface" is a valid "text" token but not a "tintBorder" token.
const invalidEyebrowTextColor: EyebrowTextColor = "surface";
void invalidEyebrowTextColor;
