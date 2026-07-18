import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import LearningErrorWindow from "../../src/learning-engine-components/LearningWindows/Error/LearningErrorWindow";
import {
  LEARNING_ROUTE_ERROR_HOME_PATH,
  getLearningRouteErrorPresentation,
  type LearningRouteErrorCode,
} from "../../src/lib/learning-engine/errors/LearningRouteError";

const ERROR_CODES: LearningRouteErrorCode[] = [
  "LEARNING_MODULE_NOT_FOUND",
  "VOCABULARY_LIST_ID_MISSING",
  "VOCABULARY_LIST_NOT_FOUND",
  "INVALID_LEARNING_ROUTE",
];

test("renders learner-safe route errors with a Return Home recovery link", () => {
  for (const code of ERROR_CODES) {
    const presentation = getLearningRouteErrorPresentation(code);
    const markup = renderToStaticMarkup(
      <LearningErrorWindow {...presentation} />
    );

    assert.match(markup, new RegExp(presentation.title));
    assert.match(markup, new RegExp(presentation.message));
    assert.match(markup, /Return Home/);
    assert.match(markup, new RegExp(`href="${LEARNING_ROUTE_ERROR_HOME_PATH}"`));
    assert.doesNotMatch(markup, new RegExp(code));
  }
});
