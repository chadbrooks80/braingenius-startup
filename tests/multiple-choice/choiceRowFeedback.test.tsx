import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ChoiceRow } from "../../src/components/learning-engine/windows/MultipleChoice/MultipleChoiceWindow";

const BASE_PROPS = {
  text: "Photosynthesis",
  disabled: false,
  onClick: () => {},
};

test("before grading, an unanswered choice renders no icon, label, or correctness text", () => {
  const markup = renderToStaticMarkup(
    <ChoiceRow {...BASE_PROPS} answered={false} isCorrect={false} isSelected={false} />
  );

  assert.doesNotMatch(markup, /<svg/);
  assert.doesNotMatch(markup, /Correct/);
  assert.doesNotMatch(markup, /incorrect/i);
});

test("an unanswered choice renders no indicator even when it happens to be the eventual correct/selected one", () => {
  // Proves pre-grade props alone cannot leak correctness: the same
  // isCorrect/isSelected values that produce visible indicators once
  // `answered` is true produce nothing while `answered` is false.
  const markup = renderToStaticMarkup(
    <ChoiceRow {...BASE_PROPS} answered={false} isCorrect isSelected />
  );

  assert.doesNotMatch(markup, /<svg/);
  assert.doesNotMatch(markup, /Correct/);
  assert.doesNotMatch(markup, /incorrect/i);
});

test("after grading, the correct choice shows a decorative check icon and visible 'Correct' text", () => {
  const markup = renderToStaticMarkup(
    <ChoiceRow {...BASE_PROPS} answered isCorrect isSelected={false} />
  );

  assert.match(markup, /<svg[^>]*aria-hidden="true"/);
  assert.match(markup, />Correct</);
});

test("after a wrong submission, the actual correct row is still identified even though it was not selected", () => {
  const markup = renderToStaticMarkup(
    <ChoiceRow {...BASE_PROPS} answered isCorrect isSelected={false} />
  );

  assert.match(markup, />Correct</, "the correct row must be identified regardless of the learner's selection");
});

test("after grading, the selected incorrect choice shows a decorative X icon and visible 'Your answer — incorrect' text", () => {
  const markup = renderToStaticMarkup(
    <ChoiceRow {...BASE_PROPS} answered isCorrect={false} isSelected />
  );

  assert.match(markup, /<svg[^>]*aria-hidden="true"/);
  assert.match(markup, />Your answer — incorrect</);
  assert.doesNotMatch(markup, />Correct</);
});

test("after grading, an unrelated unselected/incorrect choice shows no indicator", () => {
  const markup = renderToStaticMarkup(
    <ChoiceRow {...BASE_PROPS} answered isCorrect={false} isSelected={false} />
  );

  assert.doesNotMatch(markup, /<svg/);
  assert.doesNotMatch(markup, /Correct/);
  assert.doesNotMatch(markup, /incorrect/i);
});

test("feedback is communicated through visible text, not color alone, for both graded outcomes", () => {
  const correctMarkup = renderToStaticMarkup(
    <ChoiceRow {...BASE_PROPS} answered isCorrect isSelected={false} />
  );
  const incorrectMarkup = renderToStaticMarkup(
    <ChoiceRow {...BASE_PROPS} answered isCorrect={false} isSelected />
  );

  // Supplemental color classes remain (existing success/danger tokens),
  // but each graded row also carries visible, non-color text.
  assert.match(correctMarkup, /text-secondary-strong/);
  assert.match(correctMarkup, />Correct</);
  assert.match(incorrectMarkup, /border-danger/);
  assert.match(incorrectMarkup, />Your answer — incorrect</);
});
