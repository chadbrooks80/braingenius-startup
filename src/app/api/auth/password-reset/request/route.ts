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

const RequestSchema = z.object({
  email: z.email(),
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

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashValue(token),
          expiresAt: hoursFromNow(PASSWORD_RESET_EXPIRY_HOURS),
        },
      });

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

      try {
        await sendPasswordResetEmail(email, resetUrl);
      } catch (error) {
        console.error("sendPasswordResetEmail failed:", error);
      }
    }
  }

  // Always return the same generic response, rate-limited or not, so the
  // response shape never reveals whether an account exists.
  return NextResponse.json({ success: true });
}
