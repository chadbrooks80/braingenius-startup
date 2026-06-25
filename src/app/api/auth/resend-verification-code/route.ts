import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import {
  generateVerificationCode,
  hashValue,
  minutesFromNow,
  RESEND_COOLDOWN_SECONDS,
  VERIFICATION_CODE_EXPIRY_MINUTES,
} from "@/lib/auth-tokens";
import { sendVerificationCodeEmail } from "@/lib/email";

const ResendSchema = z.object({
  email: z.email(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ResendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: true });
  }

  const { email } = parsed.data;

  const lastCode = await prisma.emailVerificationCode.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });

  if (lastCode && Date.now() - lastCode.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    return NextResponse.json(
      { success: false, error: "Please wait before requesting another verification code." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.emailVerified) {
    await prisma.emailVerificationCode.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = generateVerificationCode();

    await prisma.emailVerificationCode.create({
      data: {
        email,
        codeHash: hashValue(code),
        expiresAt: minutesFromNow(VERIFICATION_CODE_EXPIRY_MINUTES),
      },
    });

    try {
      await sendVerificationCodeEmail(email, code);
    } catch (error) {
      console.error("sendVerificationCodeEmail failed:", error);
    }
  }

  return NextResponse.json({ success: true });
}
