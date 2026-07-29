import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { attemptEmailVerification } from "@/lib/email-verification";
import { CanonicalEmailSchema } from "@/lib/auth/email-normalization";

const VerifySchema = z.object({
  email: CanonicalEmailSchema,
  code: z.string().length(4),
});

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

// One identical learner-safe response for every normal failure state (no
// active code, wrong code, expired code, exhausted attempts) so the caller
// can't learn which of those states applies -- and therefore can't learn
// whether the email exists, is already verified, or has an active code.
function genericFailure(): NextResponse {
  return NextResponse.json(
    { success: false, error: "That code is incorrect or has expired. Please request a new one." },
    { status: 400, headers: NO_STORE_HEADERS }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = VerifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const { email, code } = parsed.data;
  const result = await attemptEmailVerification(email, code);

  if (!result.success) {
    return genericFailure();
  }

  return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}
