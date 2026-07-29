import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import {
  generateResetToken,
  hashValue,
  hoursFromNow,
  PASSWORD_RESET_EXPIRY_HOURS,
  RESEND_COOLDOWN_SECONDS,
} from "@/lib/auth-tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { buildPasswordResetUrl } from "@/lib/app-base-url";
import { CanonicalEmailSchema } from "@/lib/auth/email-normalization";

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

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.password) {
    const lastToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const isRateLimited =
      lastToken && Date.now() - lastToken.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000;

    if (!isRateLimited) {
      const token = generateResetToken();
      const resetUrl = buildPasswordResetUrl(token, email);

      if (!resetUrl) {
        // No trusted application origin is configured (only possible in
        // production; a non-production environment always has the
        // localhost fallback). Never create or send an unusable reset
        // link, and never log the email, token, or environment value.
        console.error(
          "Password reset request skipped: no trusted application origin is configured."
        );
      } else {
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashValue(token),
            expiresAt: hoursFromNow(PASSWORD_RESET_EXPIRY_HOURS),
          },
        });

        try {
          await sendPasswordResetEmail(email, resetUrl.toString());
        } catch (error) {
          console.error("sendPasswordResetEmail failed:", error);
        }
      }
    }
  }

  // Always return the same generic response, rate-limited or not, so the
  // response shape never reveals whether an account exists.
  return NextResponse.json({ success: true });
}
