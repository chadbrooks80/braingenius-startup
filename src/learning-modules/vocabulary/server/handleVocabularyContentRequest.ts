import { getVocabularyContent } from "./getVocabularyContent";
import { parseVocabularyContentRequest } from "./parseVocabularyContentRequest";
import {
  vocabularyContentCapabilityStore,
  type VocabularyContentCapabilityStore,
} from "./VocabularyContentCapabilityStore";
import {
  getOrCreateVocabularyLearner,
  getVocabularyLearnerId,
} from "./vocabularyLearnerSession";

export async function handleVocabularyContentRequest(
  request: Request,
  capabilityStore: VocabularyContentCapabilityStore =
    vocabularyContentCapabilityStore
): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const contentRequest = parseVocabularyContentRequest(rawBody);
  if (!contentRequest) {
    return Response.json(
      { error: "Invalid vocabulary content request." },
      { status: 400 }
    );
  }

  if (contentRequest.contentType === "manifest") {
    const { learnerId, setCookie } = getOrCreateVocabularyLearner(request);
    const manifest = capabilityStore.createManifest(
      learnerId,
      contentRequest.wordListId
    );
    if (!manifest) {
      return Response.json(
        { error: "Vocabulary content was not found." },
        { status: 404 }
      );
    }

    const headers = new Headers({ "Cache-Control": "no-store" });
    if (setCookie) {
      headers.set("Set-Cookie", setCookie);
    }
    return Response.json(manifest, { headers });
  }

  const learnerId = getVocabularyLearnerId(request);
  if (!learnerId) {
    return invalidCapabilityResponse();
  }

  const authorization = capabilityStore.authorizeContent(
    learnerId,
    contentRequest.lessonId,
    contentRequest.capability,
    contentRequest.contentType,
    contentRequest.contentType === "answer-recap"
      ? contentRequest.exampleIndex
      : undefined
  );
  if (!authorization) {
    return invalidCapabilityResponse();
  }

  const cachedContent = capabilityStore.getCachedContent(authorization);
  const content =
    cachedContent ??
    getVocabularyContent({
      ...authorization,
      ...(contentRequest.contentType === "answer-recap"
        ? { exampleIndex: contentRequest.exampleIndex }
        : {}),
    });
  if (!content) {
    return Response.json(
      { error: "Vocabulary content was not found." },
      { status: 404 }
    );
  }

  if (!cachedContent) {
    capabilityStore.recordContentResponse(authorization, content);
  }

  return Response.json(content, {
    headers: { "Cache-Control": "no-store" },
  });
}

function invalidCapabilityResponse(): Response {
  return Response.json(
    { error: "Invalid vocabulary content capability." },
    { status: 400 }
  );
}
