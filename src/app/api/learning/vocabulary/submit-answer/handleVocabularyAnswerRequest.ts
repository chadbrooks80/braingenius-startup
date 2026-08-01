import type { VocabularyAnswerApiResult, VocabularyAnswerSubmission } from "@/learning-modules/vocabulary/types";
import { parseVocabularyAnswerSubmission } from "@/learning-modules/vocabulary/validation/parseVocabularySubmitAnswerPayload";

type VocabularyAnswerLookup = (
  submission: VocabularyAnswerSubmission
) => Promise<VocabularyAnswerApiResult | null>;

export async function handleVocabularyAnswerRequest(
  request: Request,
  getVocabularyAnswer: VocabularyAnswerLookup
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

  const submission = parseVocabularyAnswerSubmission(rawBody);
  if (!submission) {
    return Response.json(
      { error: "Invalid vocabulary answer submission." },
      { status: 400 }
    );
  }

  let result: VocabularyAnswerApiResult | null;
  try {
    result = await getVocabularyAnswer(submission);
  } catch (error) {
    console.error("[vocabulary-submit-answer] grading unavailable", error);
    return Response.json(
      { error: "This learning module is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!result) {
    return Response.json(
      { error: "Invalid vocabulary answer submission." },
      { status: 400 }
    );
  }

  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
