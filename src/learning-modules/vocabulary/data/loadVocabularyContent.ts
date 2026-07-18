import type {
  VocabularyChoice,
  VocabularyContentRequest,
  VocabularyContentResponseFor,
} from "./vocabularyContentTypes";

const CONTENT_ENDPOINT = "/api/learning/vocabulary/content";
const CONTENT_TIMEOUT_MS = 10_000;

export type VocabularyContentLoader = <Request extends VocabularyContentRequest>(
  request: Request
) => Promise<VocabularyContentResponseFor<Request> | null>;

type LoadVocabularyContentOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function loadVocabularyContent<
  Request extends VocabularyContentRequest,
>(
  request: Request,
  options: LoadVocabularyContentOptions = {}
): Promise<VocabularyContentResponseFor<Request> | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? CONTENT_TIMEOUT_MS
  );

  let response: Response;
  try {
    response = await fetchImpl(CONTENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new Error("Vocabulary content request timed out.", { cause });
    }
    throw new Error("Vocabulary content request could not be completed.", {
      cause,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Vocabulary content request failed with status ${response.status}.`);
  }

  const rawContent: unknown = await response.json();
  if (!isValidContentResponse(request, rawContent)) {
    throw new Error("Vocabulary content request returned an invalid result.");
  }

  return rawContent;
}

function isValidContentResponse<Request extends VocabularyContentRequest>(
  request: Request,
  raw: unknown
): raw is VocabularyContentResponseFor<Request> {
  if (!isRecord(raw) || raw.contentType !== request.contentType) {
    return false;
  }

  switch (request.contentType) {
    case "manifest":
      return (
        hasExactFields(raw, [
          "contentType",
          "lessonId",
          "randomSeed",
          "nextCapability",
          "words",
        ]) &&
        isOpaqueIdentifier(raw.lessonId) &&
        Number.isInteger(raw.randomSeed) &&
        typeof raw.randomSeed === "number" &&
        raw.randomSeed >= 0 &&
        raw.randomSeed <= 4_294_967_295 &&
        isOpaqueIdentifier(raw.nextCapability) &&
        Array.isArray(raw.words) &&
        raw.words.length > 0 &&
        raw.words.every(isManifestWord) &&
        new Set(raw.words.map((word) => word.id)).size === raw.words.length
      );
    case "definition-display":
      return (
        hasExactFields(raw, [
          "contentType",
          "nextCapability",
          "word",
          "definition",
          "exampleSentences",
        ]) &&
        isOpaqueIdentifier(raw.nextCapability) &&
        isNonBlankString(raw.word) &&
        isNonBlankString(raw.definition) &&
        isThreeNonBlankStrings(raw.exampleSentences)
      );
    case "definition-fun-fact":
      return (
        hasExactFields(raw, [
          "contentType",
          "nextCapability",
          "word",
          "interestingFact",
        ]) &&
        isOpaqueIdentifier(raw.nextCapability) &&
        isNonBlankString(raw.word) &&
        isNonBlankString(raw.interestingFact)
      );
    case "definition-practice":
      return (
        hasExactFields(raw, [
          "contentType",
          "nextCapability",
          "attemptId",
          "question",
          "choices",
        ]) &&
        isOpaqueIdentifier(raw.nextCapability) &&
        isOpaqueIdentifier(raw.attemptId) &&
        isNonBlankString(raw.question) &&
        isFourUniqueChoices(raw.choices)
      );
    case "spelling-practice":
      return (
        hasExactFields(raw, [
          "contentType",
          "nextCapability",
          "attemptId",
          "definition",
        ]) &&
        isOpaqueIdentifier(raw.nextCapability) &&
        isOpaqueIdentifier(raw.attemptId) &&
        isNonBlankString(raw.definition)
      );
    case "answer-recap":
      return (
        hasExactFields(raw, [
          "contentType",
          "nextCapability",
          "word",
          "definition",
          "exampleSentence",
        ]) &&
        isOpaqueIdentifier(raw.nextCapability) &&
        isNonBlankString(raw.word) &&
        isNonBlankString(raw.definition) &&
        isNonBlankString(raw.exampleSentence)
      );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isOpaqueIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isManifestWord(value: unknown): value is {
  id: string;
} {
  return (
    isRecord(value) &&
    hasExactFields(value, ["id"]) &&
    isOpaqueIdentifier(value.id)
  );
}

function hasExactFields(
  value: Record<string, unknown>,
  fields: readonly string[]
): boolean {
  const actualFields = Object.keys(value);
  return (
    actualFields.length === fields.length &&
    actualFields.every((field) => fields.includes(field))
  );
}

function isThreeNonBlankStrings(
  value: unknown
): value is [string, string, string] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(isNonBlankString)
  );
}

function isFourUniqueChoices(
  value: unknown
): value is [VocabularyChoice, VocabularyChoice, VocabularyChoice, VocabularyChoice] {
  if (!Array.isArray(value) || value.length !== 4) {
    return false;
  }

  const choices = value.filter(isVocabularyChoice);
  return (
    choices.length === 4 &&
    new Set(choices.map((choice) => choice.id)).size === 4
  );
}

function isVocabularyChoice(value: unknown): value is VocabularyChoice {
  return (
    isRecord(value) &&
    hasExactFields(value, ["id", "text"]) &&
    isNonBlankString(value.id) &&
    isNonBlankString(value.text)
  );
}
