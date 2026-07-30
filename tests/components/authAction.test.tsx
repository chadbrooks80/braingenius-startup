import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AuthAction from "../../src/components/layout/header/AuthAction";

// This repository's component-test harness is React server rendering
// (`renderToStaticMarkup`) with no DOM/jsdom, so this file proves only the
// statically verifiable contract: which branch renders for each
// `isAuthenticated` value, the exact copy and target of each branch, and
// that no `Button` variant/className escape hatch beyond what the component
// itself passes through is introduced. It does NOT and cannot prove that
// clicking "Sign Out" calls `next-auth/react`'s `signOut()`, that the
// pending "Signing Out..." label and `disabled` state actually appear after
// a real click, or that the header re-renders "Sign In" once the session is
// cleared -- those require a real browser and are not covered by any
// existing e2e test in this repository.

test("signed out: renders a Sign In link to /sign-in, not a button", () => {
  const markup = renderToStaticMarkup(<AuthAction isAuthenticated={false} />);

  assert.match(markup, /<a[^>]*href="\/sign-in"[^>]*>Sign In<\/a>/);
  assert.doesNotMatch(markup, /<button/);
});

test("signed in: renders a Sign Out button, not a link", () => {
  const markup = renderToStaticMarkup(<AuthAction isAuthenticated />);

  assert.match(markup, /<button[^>]*>Sign Out<\/button>/);
  assert.doesNotMatch(markup, /<a[^>]*href=/);
});

test("signed in: the Sign Out button is not disabled before any click", () => {
  const markup = renderToStaticMarkup(<AuthAction isAuthenticated />);

  assert.doesNotMatch(markup, /disabled=""/);
  assert.doesNotMatch(markup, /Signing Out/);
});

test("className is forwarded to the rendered control in both auth states", () => {
  const signedOutMarkup = renderToStaticMarkup(
    <AuthAction isAuthenticated={false} className="w-full justify-center" />
  );
  const signedInMarkup = renderToStaticMarkup(
    <AuthAction isAuthenticated className="w-full justify-center" />
  );

  assert.match(signedOutMarkup, /class="[^"]*w-full justify-center[^"]*"/);
  assert.match(signedInMarkup, /class="[^"]*w-full justify-center[^"]*"/);
});

test("no raw color literal or Tailwind default-palette class is rendered", () => {
  const markup = renderToStaticMarkup(<AuthAction isAuthenticated={false} />);

  assert.doesNotMatch(markup, /#[0-9a-fA-F]{3,8}/);
  assert.doesNotMatch(markup, /\b(red|slate|white|black)-\d{2,3}\b/);
});
