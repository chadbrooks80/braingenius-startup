import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SpeechPlaybackFailureBanner,
  SPEECH_FAILURE_AUTO_DISMISS_MS,
} from "../../src/components/learning-engine/SpeechPlaybackFailureBanner";

// This repository's component-test harness is React server rendering
// (`renderToStaticMarkup`) with no DOM/jsdom, so this file proves only the
// statically verifiable contract: exact copy, alert semantics, the X button's
// accessible name, and absence of diagnostic/inline-style leakage. It does
// NOT and cannot prove the 12-second auto-dismiss timer, timer cleanup on
// unmount/replacement, or a real click dismissing the banner — those require
// a real browser and are covered by tests/e2e/speechPlaybackFailure.e2e.ts.

test("the exact learner copy renders exactly once", () => {
  const markup = renderToStaticMarkup(
    <SpeechPlaybackFailureBanner requestId={1} onDismiss={() => {}} />
  );

  const matches =
    markup.match(/Audio couldn(?:&#x27;|')t play\. Please try again\./g) ?? [];
  assert.equal(matches.length, 1);
});

test("the banner exposes role=alert and aria-atomic for a single non-duplicated announcement", () => {
  const markup = renderToStaticMarkup(
    <SpeechPlaybackFailureBanner requestId={1} onDismiss={() => {}} />
  );

  assert.match(markup, /role="alert"/);
  assert.match(markup, /aria-atomic="true"/);
  assert.equal((markup.match(/role="alert"/g) ?? []).length, 1);
});

test("the X is a real button with the accessible name Dismiss audio error", () => {
  const markup = renderToStaticMarkup(
    <SpeechPlaybackFailureBanner requestId={1} onDismiss={() => {}} />
  );

  assert.match(markup, /<button[^>]*aria-label="Dismiss audio error"[^>]*>/);
});

test("no diagnostic, status, or provider fixture text is rendered", () => {
  const markup = renderToStaticMarkup(
    <SpeechPlaybackFailureBanner requestId={1} onDismiss={() => {}} />
  );

  for (const forbidden of [
    "stage",
    "httpStatus",
    "mediaErrorCode",
    "errorName",
    "provider",
    "lemonfox",
    "google",
    "404",
    "500",
  ]) {
    assert.doesNotMatch(markup, new RegExp(forbidden, "i"));
  }
});

test("no inline style attribute is rendered", () => {
  const markup = renderToStaticMarkup(
    <SpeechPlaybackFailureBanner requestId={1} onDismiss={() => {}} />
  );

  assert.doesNotMatch(markup, /style="/);
});

test("the exported auto-dismiss timeout constant equals 12000", () => {
  assert.equal(SPEECH_FAILURE_AUTO_DISMISS_MS, 12_000);
});
