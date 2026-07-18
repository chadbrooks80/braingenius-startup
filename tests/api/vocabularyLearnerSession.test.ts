import assert from "node:assert/strict";
import test from "node:test";
import {
  getOrCreateVocabularyLearner,
  getVocabularyLearnerId,
} from "../../src/learning-modules/vocabulary/server/vocabularyLearnerSession";

test("malformed learner-cookie encoding is treated as an invalid session", () => {
  const request = new Request("https://learning.example", {
    headers: { Cookie: "brain-genius-learner=%E0%A4%A" },
  });

  assert.equal(getVocabularyLearnerId(request), null);
});

test("learner cookies are Secure on HTTPS and remain usable for local HTTP", () => {
  const httpsCookie = getOrCreateVocabularyLearner(
    new Request("https://learning.example")
  ).setCookie;
  const httpCookie = getOrCreateVocabularyLearner(
    new Request("http://127.0.0.1:3000")
  ).setCookie;

  assert.match(httpsCookie ?? "", /; Secure$/);
  assert.doesNotMatch(httpCookie ?? "", /; Secure(?:;|$)/);
  assert.match(httpsCookie ?? "", /HttpOnly; SameSite=Strict/);
});
