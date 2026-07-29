import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendVerificationCodeEmail } from "@/lib/email";
import { CanonicalEmailSchema } from "@/lib/auth/email-normalization";
import { replaceVerificationCode } from "@/lib/auth/verification-code-resend";

const ResendSchema = z.object({
  email: CanonicalEmailSchema,
});

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ResendSchema.safeParse(body);

  if (parsed.success) {
    try {
      const replacement = await replaceVerificationCode(parsed.data.email);
      if (replacement.status === "send") {
        try {
          await sendVerificationCodeEmail(replacement.email, replacement.code);
        } catch {
          console.error("Verification-code delivery failed after replacement commit.");
        }
      }
    } catch {
      console.error("Verification-code replacement transaction failed.");
    }
  }

  // Always return the same generic response -- malformed input, unknown
  // email, already-verified account, cooldown, and eligible-unverified
  // account all look identical to the caller.
  return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}
