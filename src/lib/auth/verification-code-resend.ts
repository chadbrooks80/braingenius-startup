import "server-only";
import { OnboardingStep, UserRole } from "@/generated/prisma";
import {
  generateVerificationCode,
  hashValue,
  RESEND_COOLDOWN_SECONDS,
  VERIFICATION_CODE_EXPIRY_MINUTES,
} from "@/lib/auth-tokens";
import { normalizeEmail } from "@/lib/auth/email-normalization";
import prisma, { lockUserRow } from "@/lib/db";

export type VerificationCodeReplacement =
  | { status: "send"; email: string; code: string }
  | { status: "no-send" };

const NO_SEND: VerificationCodeReplacement = { status: "no-send" };

/**
 * Serializes verification-code replacement on the canonical user's row.
 * Eligibility, cooldown, invalidation, and replacement creation share one
 * transaction; the returned plaintext code exists only for post-commit
 * delivery by the route.
 */
export async function replaceVerificationCode(
  rawEmail: string
): Promise<VerificationCodeReplacement> {
  const email = normalizeEmail(rawEmail);
  if (!email) {
    return NO_SEND;
  }

  const now = new Date();
  const code = generateVerificationCode();
  const codeHash = hashValue(code);
  const expiresAt = new Date(
    now.getTime() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000
  );

  return prisma.$transaction(async (tx) => {
    const candidate = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!candidate) {
      return NO_SEND;
    }

    await lockUserRow(tx, candidate.id);

    const user = await tx.user.findUnique({
      where: { id: candidate.id },
      select: {
        email: true,
        emailVerified: true,
        role: true,
        onboardingStep: true,
        onboardingCompleted: true,
      },
    });
    if (
      !user ||
      user.email !== email ||
      user.emailVerified !== null ||
      user.role !== UserRole.PARENT ||
      user.onboardingStep !== OnboardingStep.VERIFY_EMAIL ||
      user.onboardingCompleted
    ) {
      return NO_SEND;
    }

    const lastCode = await tx.emailVerificationCode.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });
    if (
      lastCode &&
      now.getTime() - lastCode.createdAt.getTime() <
        RESEND_COOLDOWN_SECONDS * 1000
    ) {
      return NO_SEND;
    }

    await tx.emailVerificationCode.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: now },
    });
    await tx.emailVerificationCode.create({
      data: { email, codeHash, expiresAt },
    });

    return { status: "send", email, code };
  });
}
