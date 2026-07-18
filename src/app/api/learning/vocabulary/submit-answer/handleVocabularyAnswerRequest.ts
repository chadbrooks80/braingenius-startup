import type {
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "@/learning-modules/vocabulary/types";
import { parseVocabularyAnswerSubmission } from "@/learning-modules/vocabulary/validation/parseVocabularySubmitAnswerPayload";

type VocabularyAnswerLookup = (
  submission: VocabularyAnswerSubmission
) => VocabularyAnswerResult | null;

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

  const result = getVocabularyAnswer(submission);
  if (!result) {
    return Response.json(
      { error: "Invalid vocabulary answer submission." },
      { status: 400 }
    );
  }

  return Response.json(result);
}
