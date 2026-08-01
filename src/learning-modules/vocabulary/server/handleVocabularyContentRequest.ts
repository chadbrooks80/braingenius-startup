import { parseVocabularyContentRequest } from "./parseVocabularyContentRequest";
import {
  vocabularyContentCapabilityStore,
  type VocabularyContentCapabilityStore,
} from "./VocabularyContentCapabilityStore";

function unavailableResponse(): Response {
  return Response.json(
    { error: "This learning module is temporarily unavailable." },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

function notFoundResponse(): Response {
  return Response.json(
    { error: "Vocabulary content was not found." },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}

function invalidCapabilityResponse(): Response {
  return Response.json(
    { error: "Invalid vocabulary content capability." },
    { status: 400, headers: { "Cache-Control": "no-store" } }
  );
}

export async function handleVocabularyContentRequest(
  request: Request,
  userId: string,
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
    let manifest;
    try {
      manifest = await capabilityStore.createManifest(
        userId,
        contentRequest.learningId
      );
    } catch (error) {
      console.error("[vocabulary-content] manifest creation unavailable", error);
      return unavailableResponse();
    }
    if (!manifest) {
      return notFoundResponse();
    }

    return Response.json(manifest, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (contentRequest.contentType === "word-refill") {
    let outcome;
    try {
      outcome = await capabilityStore.refillNextWord(
        userId,
        contentRequest.lessonId
      );
    } catch (error) {
      console.error("[vocabulary-content] refill unavailable", error);
      return unavailableResponse();
    }
    if (!outcome) {
      return invalidCapabilityResponse();
    }
    return Response.json(
      { contentType: "word-refill", wordId: outcome.wordId },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  let authorization;
  try {
    authorization = await capabilityStore.authorizeContent(
      userId,
      contentRequest.lessonId,
      contentRequest.capability,
      contentRequest.contentType,
      contentRequest.contentType === "answer-recap"
        ? contentRequest.exampleIndex
        : undefined
    );
  } catch (error) {
    console.error("[vocabulary-content] authorization unavailable", error);
    return unavailableResponse();
  }
  if (!authorization) {
    return invalidCapabilityResponse();
  }

  const cachedContent = capabilityStore.getCachedContent(authorization);
  let built;
  if (cachedContent) {
    built = { content: cachedContent };
  } else {
    try {
      built = await capabilityStore.buildContent(
        authorization,
        contentRequest.contentType === "answer-recap"
          ? contentRequest.exampleIndex
          : undefined
      );
    } catch (error) {
      console.error("[vocabulary-content] content build unavailable", error);
      return unavailableResponse();
    }
  }
  if (!built) {
    return notFoundResponse();
  }

  if (!cachedContent) {
    capabilityStore.recordContentResponse(authorization, built);
  }

  return Response.json(built.content, {
    headers: { "Cache-Control": "no-store" },
  });
}
