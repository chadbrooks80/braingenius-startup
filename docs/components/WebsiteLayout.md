# WebsiteLayout

**Path:** `src/app/(website)/layout.tsx`

Route-group layout for the public-facing website (`(website)`). Renders the site `Header` above all website pages and wraps children in a `flex-1` container so the body's `flex-col` layout fills the viewport correctly.

Does **not** apply to app or playground routes — those route groups have their own layouts.

## Usage

This layout is applied automatically by Next.js to every route inside `src/app/(website)/`. No manual wrapping is needed.

## Props

| Prop       | Type              | Description                      |
|------------|-------------------|----------------------------------|
| `children` | `React.ReactNode` | The page content to render below the header |
