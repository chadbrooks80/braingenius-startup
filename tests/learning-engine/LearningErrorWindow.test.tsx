import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import LearningErrorWindow from "../../src/components/learning-engine/windows/Error/LearningErrorWindow";
import { LEARNING_ROUTE_ERROR_HOME_PATH } from "../../src/lib/learning-engine/errors/LearningRouteError";

const DIAGNOSTIC_SENTINEL = "raw-route-diagnostic-must-not-render";

test("renders an approved safe presentation with a Return Home recovery link", () => {
  const presentation = {
    title: "Lesson Not Found",
    message: "We could not find the lesson requested by this link.",
    technicalMessage: DIAGNOSTIC_SENTINEL,
  };
  const markup = renderToStaticMarkup(
    <LearningErrorWindow {...presentation} />
  );

  assert.match(markup, new RegExp(presentation.title));
  assert.match(markup, new RegExp(presentation.message));
  assert.match(markup, /Return Home/);
  assert.match(markup, new RegExp(`href="${LEARNING_ROUTE_ERROR_HOME_PATH}"`));
  assert.doesNotMatch(markup, new RegExp(DIAGNOSTIC_SENTINEL));
});
