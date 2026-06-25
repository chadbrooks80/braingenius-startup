import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { hashValue, VERIFICATION_CODE_MAX_ATTEMPTS } from "@/lib/auth-tokens";

const VerifySchema = z.object({
  email: z.email(),
  code: z.string().length(4),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = VerifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const { email, code } = parsed.data;

  const verificationCode = await prisma.emailVerificationCode.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!verificationCode) {
    return NextResponse.json(
      { success: false, error: "No active verification code found." },
      { status: 400 }
    );
  }

  if (verificationCode.expiresAt < new Date()) {
    return NextResponse.json(
      { success: false, error: "This code has expired. Please request a new one." },
      { status: 400 }
    );
  }

  if (verificationCode.attempts >= VERIFICATION_CODE_MAX_ATTEMPTS) {
    return NextResponse.json(
      { success: false, error: "Too many failed attempts. Please request a new code." },
      { status: 400 }
    );
  }

  if (hashValue(code) !== verificationCode.codeHash) {
    await prisma.emailVerificationCode.update({
      where: { id: verificationCode.id },
      data: { attempts: { increment: 1 } },
    });

    return NextResponse.json({ success: false, error: "Incorrect code." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationCode.update({
      where: { id: verificationCode.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
