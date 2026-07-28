import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Modal from "../../src/components/ui/Modal";

// This repository's component-test harness is React server rendering
// (`renderToStaticMarkup`) with no DOM/jsdom and no testing-library
// dependency, and this feature may not add one. Static markup can prove the
// dialog's structural accessibility contract (role, aria-modal, title
// association, close-button name, panel focus fallback) but cannot execute
// effects or dispatch real focus/keyboard events. Initial focus, Tab/
// Shift+Tab wrapping, the Escape lifecycle, focus restoration, and listener
// cleanup are NOT covered here: they require a real browser keyboard check
// at the Children onboarding modal, which was not run because no authorized
// disposable authenticated test boundary was available (see the
// implementation report). No other component's test results substitute for
// that check.

test("a closed Modal renders nothing", () => {
  const markup = renderToStaticMarkup(
    <Modal open={false} onClose={() => {}} title="Add Child">
      content
    </Modal>
  );

  assert.equal(markup, "");
});

test("an open Modal exposes dialog role, aria-modal, and a labelledby association with its rendered title", () => {
  const markup = renderToStaticMarkup(
    <Modal open onClose={() => {}} title="Add First Child">
      <p>content</p>
    </Modal>
  );

  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);

  const labelledByMatch = markup.match(/aria-labelledby="([^"]+)"/);
  assert.ok(labelledByMatch, "the dialog panel must declare aria-labelledby");
  const titleId = labelledByMatch[1];

  const titleHeadingPattern = new RegExp(`<h2[^>]*id="${titleId}"[^>]*>Add First Child</h2>`);
  assert.match(markup, titleHeadingPattern);
});

test("the dialog panel accepts programmatic focus as a fallback and the close button keeps its accessible name", () => {
  const markup = renderToStaticMarkup(
    <Modal open onClose={() => {}} title="Add Child">
      content
    </Modal>
  );

  assert.match(markup, /tabindex="-1"/);
  assert.match(markup, /aria-label="Close"/);
});

test("exactly one dialog panel renders inside the backdrop container", () => {
  const markup = renderToStaticMarkup(
    <Modal open onClose={() => {}} title="Add Child">
      <p>content</p>
    </Modal>
  );

  assert.equal((markup.match(/role="dialog"/g) ?? []).length, 1);
});

test("title is a required prop, matching the only live consumer's contract", () => {
  const markup = renderToStaticMarkup(
    // @ts-expect-error title is required; this proves the type contract,
    // not runtime behavior.
    <Modal open onClose={() => {}}>
      content
    </Modal>
  );

  assert.match(markup, /role="dialog"/);
});
