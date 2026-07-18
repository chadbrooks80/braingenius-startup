import type {
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "../types";

const SUBMIT_ANSWER_ENDPOINT =
  "/api/learning/vocabulary/submit-answer";
const SUBMIT_ANSWER_TIMEOUT_MS = 10_000;

type SubmitVocabularyAnswerOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function submitVocabularyAnswer(
  payload: VocabularyAnswerSubmission,
  options: SubmitVocabularyAnswerOptions = {}
): Promise<VocabularyAnswerResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? SUBMIT_ANSWER_TIMEOUT_MS
  );

  let response: Response;
  try {
    response = await fetchImpl(SUBMIT_ANSWER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new Error("Vocabulary answer submission timed out.", { cause });
    }
    throw new Error("Vocabulary answer submission could not be completed.", {
      cause,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(
      `Vocabulary answer submission failed with status ${response.status}.`
    );
  }

  const result: unknown = await response.json();
  if (!isValidResultForPayload(payload, result)) {
    throw new Error("Vocabulary answer submission returned an invalid result.");
  }

  return result;
}

function isValidResultForPayload(
  payload: VocabularyAnswerSubmission,
  result: unknown
): result is VocabularyAnswerResult {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    return false;
  }

  const body = result as Record<string, unknown>;

  if (payload.answerType === "definition") {
    return (
      body.answerType === "definition" &&
      typeof body.correctChoiceId === "string" &&
      body.correctChoiceId !== "" &&
      Object.keys(body).length === 2
    );
  }

  if (body.answerType !== "spelling" || typeof body.correct !== "boolean") {
    return false;
  }

  return body.correct
    ? Object.keys(body).length === 2
    : typeof body.correctAnswer === "string" &&
        body.correctAnswer !== "" &&
        Object.keys(body).length === 3;
}
