import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Button from "../../src/components/ui/Button";
import Input from "../../src/components/ui/Input";
import PasswordInput from "../../src/components/ui/PasswordInput";
import { LearningWindowShell } from "../../src/components/learning-engine/LearningWindowShell";

test("Button renders an anchor when href is supplied and a button otherwise", () => {
  const anchorMarkup = renderToStaticMarkup(<Button href="/x">Go</Button>);
  assert.match(anchorMarkup, /<a[^>]*href="\/x"/);

  const buttonMarkup = renderToStaticMarkup(<Button>Go</Button>);
  assert.match(buttonMarkup, /<button/);
  assert.doesNotMatch(buttonMarkup, /<a[ >]/);
});

test('Button defaults non-anchor elements to type="button" and preserves explicit type="submit"', () => {
  const defaultMarkup = renderToStaticMarkup(<Button>Go</Button>);
  assert.match(defaultMarkup, /type="button"/);

  const submitMarkup = renderToStaticMarkup(<Button type="submit">Go</Button>);
  assert.match(submitMarkup, /type="submit"/);
});

test("website, oauth, and Learning Engine variants resolve to the intended existing class recipes", () => {
  const cta = renderToStaticMarkup(
    <Button variant="cta" href="/a">
      CTA
    </Button>
  );
  assert.match(cta, /bg-heading/);

  const primary = renderToStaticMarkup(<Button variant="primary">Primary</Button>);
  assert.match(primary, /from-primary/);

  const secondary = renderToStaticMarkup(<Button variant="secondary">Secondary</Button>);
  assert.match(secondary, /bg-transparent/);

  const oauth = renderToStaticMarkup(<Button variant="oauth">OAuth</Button>);
  assert.match(oauth, /bg-surface/);
  assert.doesNotMatch(oauth, /bg-transparent/);

  const learningPrimary = renderToStaticMarkup(<Button variant="learning-primary">Next</Button>);
  assert.match(learningPrimary, /bg-heading/);
  assert.match(learningPrimary, /rounded-xl/);

  const learningSecondary = renderToStaticMarkup(<Button variant="learning-secondary">Retry</Button>);
  assert.match(learningSecondary, /bg-secondary\/\(--alpha-subtle\)/);

  const learningGhost = renderToStaticMarkup(<Button variant="learning-ghost">Skip</Button>);
  assert.match(learningGhost, /text-muted/);

  const learningAccent = renderToStaticMarkup(<Button variant="learning-accent">Next</Button>);
  assert.match(learningAccent, /from-primary/);
  assert.match(learningAccent, /rounded-xl/);
});

test("disabled Button styling is owned by the canonical component", () => {
  const markup = renderToStaticMarkup(<Button disabled>Go</Button>);
  assert.match(markup, /disabled:cursor-not-allowed/);
  assert.match(markup, /disabled:opacity-\(--alpha-surface-soft\)/);
  assert.match(markup, /disabled:transform-none/);
});

test("Input default, code, and learning-answer variants contain the intended recipe and focus utilities", () => {
  const defaultInput = renderToStaticMarkup(<Input value="" onChange={() => {}} />);
  assert.match(defaultInput, /rounded-\(--radius-lg\)/);
  assert.match(defaultInput, /focus:border-focus/);
  assert.match(defaultInput, /focus-visible:ring-2/);

  const codeInput = renderToStaticMarkup(<Input variant="code" value="" onChange={() => {}} />);
  assert.match(codeInput, /text-center/);
  assert.match(codeInput, /tracking-\(--tracking-label\)/);
  assert.match(codeInput, /focus:border-focus/);

  const learningAnswerInput = renderToStaticMarkup(
    <Input variant="learning-answer" value="" onChange={() => {}} />
  );
  assert.match(learningAnswerInput, /rounded-xl/);
  assert.match(learningAnswerInput, /min-w-0 flex-1/);
  assert.match(learningAnswerInput, /focus-visible:ring-2/);
});

test("PasswordInput reuses Input while preserving visibility-button accessibility", () => {
  const markup = renderToStaticMarkup(<PasswordInput value="" onChange={() => {}} />);
  assert.match(markup, /type="password"/);
  assert.match(markup, /aria-label="Show password"/);
  assert.match(markup, /rounded-\(--radius-lg\)/);
  assert.match(markup, /pr-10/);
});

test("LearningWindowShell standard, wide, center-aligned, backdrop, and no-backdrop variants resolve correctly", () => {
  const standard = renderToStaticMarkup(<LearningWindowShell>content</LearningWindowShell>);
  assert.match(standard, /max-w-lg/);
  assert.match(standard, /backdrop-blur-\(--blur-glass\)/);

  const wide = renderToStaticMarkup(<LearningWindowShell size="wide">content</LearningWindowShell>);
  assert.match(wide, /max-w-2xl/);

  const centered = renderToStaticMarkup(<LearningWindowShell align="center">content</LearningWindowShell>);
  assert.match(centered, /text-center/);

  const noBackdrop = renderToStaticMarkup(
    <LearningWindowShell backdrop={false}>content</LearningWindowShell>
  );
  assert.doesNotMatch(noBackdrop, /backdrop-blur/);
});
