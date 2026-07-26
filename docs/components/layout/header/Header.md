# Header

Source: `src/components/layout/header/Header.tsx`

## Purpose and boundary

Server Component for the public website header. It composes the logo, responsive `HeaderNav`, and sign-up CTA.

## Props

No props.

## Structure and behavior

Renders a sticky `<header>`. Mobile uses a three-column grid with menu, centered logo, and small CTA. Desktop uses logo, navigation, and default CTA. Both links target `/sign-up`. No local state or actions.

## Styling and accessibility

Uses semantic surface/primary theme utilities and shared header/container tokens. Both Next Images use `alt="BrainGenius.ai"` and eager loading. Mobile/desktop duplicates exist in mutually exclusive breakpoint wrappers.

## Consumers and tests

Rendered by `src/app/(website)/layout.tsx`, which covers `/` and `/blog`. No focused test exists.

## Usage

```tsx
import Header from "@/components/layout/header/Header";

<Header />
```
