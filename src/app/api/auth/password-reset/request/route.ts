import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateResetToken,
  hashValue,
  PASSWORD_RESET_EXPIRY_HOURS,
} from "@/lib/auth-tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { buildPasswordResetUrl, resolveAppBaseUrl } from "@/lib/app-base-url";
import { CanonicalEmailSchema } from "@/lib/auth/email-normalization";
import { issuePasswordResetToken } from "@/lib/auth/password-reset";

const RequestSchema = z.object({
  email: CanonicalEmailSchema,
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: true });
  }

  const { email } = parsed.data;
  const resetOrigin = resolveAppBaseUrl();

  if (!resetOrigin) {
    console.error(
      "Password reset request skipped: no trusted application origin is configured."
    );
  } else {
    try {
      const token = generateResetToken();
      const resetUrl = buildPasswordResetUrl(token, email, resetOrigin);
      if (!resetUrl) {
        console.error("Password reset request skipped: trusted origin validation failed.");
      } else {
        const now = new Date();
        const issuance = await issuePasswordResetToken({
          rawEmail: email,
          tokenHash: hashValue(token),
          expiresAt: new Date(
            now.getTime() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000
          ),
          now,
        });

        if (issuance.status === "created") {
          try {
            await sendPasswordResetEmail(email, resetUrl.toString());
          } catch {
            console.error("Password-reset delivery failed after token commit.");
          }
        }
      }
    } catch {
      console.error("Password-reset issuance transaction failed.");
    }
  }

  // Always return the same generic response, rate-limited or not, so the
  // response shape never reveals whether an account exists.
  return NextResponse.json({ success: true });
}
