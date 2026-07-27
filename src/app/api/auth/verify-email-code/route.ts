import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { hashValue, VERIFICATION_CODE_MAX_ATTEMPTS } from "@/lib/auth-tokens";
import { getNextOnboardingStep } from "@/lib/onboarding-funnel";
import { OnboardingStep } from "@/generated/prisma";

const VerifySchema = z.object({
  email: z.email(),
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

  const verificationCode = await prisma.emailVerificationCode.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!verificationCode) {
    return genericFailure();
  }

  if (verificationCode.expiresAt < new Date()) {
    return genericFailure();
  }

  if (verificationCode.attempts >= VERIFICATION_CODE_MAX_ATTEMPTS) {
    return genericFailure();
  }

  if (hashValue(code) !== verificationCode.codeHash) {
    await prisma.emailVerificationCode.update({
      where: { id: verificationCode.id },
      data: { attempts: { increment: 1 } },
    });

    return genericFailure();
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: {
        emailVerified: new Date(),
        onboardingStep: getNextOnboardingStep(OnboardingStep.VERIFY_EMAIL),
      },
    }),
    prisma.emailVerificationCode.update({
      where: { id: verificationCode.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}
