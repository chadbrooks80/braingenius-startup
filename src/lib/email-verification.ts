import "server-only";
import prisma from "@/lib/db";
import { hashValue, VERIFICATION_CODE_MAX_ATTEMPTS } from "@/lib/auth-tokens";
import { getNextOnboardingStep } from "@/lib/onboarding-funnel";
import { OnboardingStep, UserRole } from "@/generated/prisma";
import { normalizeEmail } from "@/lib/auth/email-normalization";

export type EmailVerificationResult = { success: true } | { success: false };

/**
 * Thrown only inside the claim transaction below to force a rollback of
 * every write it made without leaking transaction internals to the caller.
 * An unexpected error (e.g. a database failure) is a different class and is
 * left to propagate to the route's existing observability path.
 */
class VerificationClaimRejected extends Error {}

/**
 * Attempts to consume the latest active verification code for `email`
 * against the submitted `code`. One captured `now` drives every eligibility
 * comparison and write. Every mutation is a conditional database operation
 * that re-validates the exact code record, email, unused/unexpired state,
 * and attempt limit against the row's state at write time, so a concurrent
 * request that loses the race can never report success or mutate a code
 * another request already consumed, expired, or exhausted.
 */
export async function attemptEmailVerification(
  rawEmail: string,
  code: string
): Promise<EmailVerificationResult> {
  // Normalized here, at the owning service boundary, rather than trusting
  // that every caller already canonicalized -- the HTTP route validates with
  // the same schema, but a direct service call with surrounding whitespace or
  // mixed case must still resolve the canonical identity instead of silently
  // matching nothing.
  const email = normalizeEmail(rawEmail);
  if (!email) {
    return { success: false };
  }

  const now = new Date();

  const verificationCode = await prisma.emailVerificationCode.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (
    !verificationCode ||
    verificationCode.expiresAt <= now ||
    verificationCode.attempts >= VERIFICATION_CODE_MAX_ATTEMPTS
  ) {
    return { success: false };
  }

  if (hashValue(code) !== verificationCode.codeHash) {
    // The conditional filter re-checks usedAt/expiresAt/attempts against the
    // row's committed state at write time, so a code a concurrent request
    // already consumed, expired, or exhausted is left untouched instead of
    // recording another attempt or exceeding the limit.
    await prisma.emailVerificationCode.updateMany({
      where: {
        id: verificationCode.id,
        email,
        usedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: VERIFICATION_CODE_MAX_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });

    return { success: false };
  }

  return claimCorrectCode(verificationCode.id, email, now);
}

async function claimCorrectCode(
  codeId: string,
  email: string,
  now: Date
): Promise<EmailVerificationResult> {
  try {
    await prisma.$transaction(async (tx) => {
      // Exactly one concurrent transaction can match this conditional claim:
      // the loser's `usedAt: null` filter fails as soon as the winner
      // commits, so it matches zero rows and performs no write.
      const claim = await tx.emailVerificationCode.updateMany({
        where: {
          id: codeId,
          email,
          usedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: VERIFICATION_CODE_MAX_ATTEMPTS },
        },
        data: { usedAt: now },
      });

      if (claim.count !== 1) {
        throw new VerificationClaimRejected();
      }

      // The same authoritative gate `advanceParentOnboardingStep` uses: only
      // a database `PARENT` still on `VERIFY_EMAIL` with onboarding
      // incomplete may be verified and advanced. A missing user, a child
      // account, an already-advanced/completed account, or a stale/replayed
      // request all legitimately match zero rows here -- and because that
      // check runs in the same transaction as the code claim above, a zero
      // match rolls the code claim back too instead of silently consuming
      // the code while reporting success for a request that changed nothing.
      const userUpdate = await tx.user.updateMany({
        where: {
          email,
          role: UserRole.PARENT,
          onboardingStep: OnboardingStep.VERIFY_EMAIL,
          onboardingCompleted: false,
        },
        data: {
          emailVerified: now,
          onboardingStep: getNextOnboardingStep(OnboardingStep.VERIFY_EMAIL),
        },
      });

      if (userUpdate.count !== 1) {
        throw new VerificationClaimRejected();
      }
    });

    return { success: true };
  } catch (error) {
    if (error instanceof VerificationClaimRejected) {
      return { success: false };
    }
    throw error;
  }
}
