import "server-only";
import { normalizeEmail } from "@/lib/auth/email-normalization";
import { RESEND_COOLDOWN_SECONDS } from "@/lib/auth-tokens";
import prisma, { lockUserRow } from "@/lib/db";

export type PasswordResetIssuanceResult =
  | { status: "created" }
  | { status: "not-created" };

const NOT_CREATED: PasswordResetIssuanceResult = { status: "not-created" };

/**
 * Creates at most one reset grant per user and cooldown window. The plaintext
 * token and URL stay with the route; this service receives only the hash.
 */
export async function issuePasswordResetToken(input: {
  rawEmail: string;
  tokenHash: string;
  expiresAt: Date;
  now: Date;
}): Promise<PasswordResetIssuanceResult> {
  const email = normalizeEmail(input.rawEmail);
  if (!email) {
    return NOT_CREATED;
  }

  return prisma.$transaction(async (tx) => {
    const candidate = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!candidate) {
      return NOT_CREATED;
    }

    await lockUserRow(tx, candidate.id);

    const user = await tx.user.findUnique({
      where: { id: candidate.id },
      select: { id: true, email: true, password: true },
    });
    if (!user || user.email !== email || !user.password) {
      return NOT_CREATED;
    }

    const lastToken = await tx.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (
      lastToken &&
      input.now.getTime() - lastToken.createdAt.getTime() <
        RESEND_COOLDOWN_SECONDS * 1000
    ) {
      return NOT_CREATED;
    }

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });

    return { status: "created" };
  });
}

export type PasswordResetConfirmationResult =
  | { status: "confirmed" }
  | { status: "invalid" };

const INVALID: PasswordResetConfirmationResult = { status: "invalid" };

/**
 * Claims one exact eligible token and changes its owner's password in the
 * same transaction. Locking the owner also serializes confirmations that use
 * different outstanding tokens for the same account.
 */
export async function confirmPasswordReset(input: {
  rawEmail: string;
  tokenHash: string;
  hashedPassword: string;
  now: Date;
}): Promise<PasswordResetConfirmationResult> {
  const email = normalizeEmail(input.rawEmail);
  if (!email) {
    return INVALID;
  }

  return prisma.$transaction(async (tx) => {
    const candidate = await tx.passwordResetToken.findUnique({
      where: { tokenHash: input.tokenHash },
      select: { id: true, userId: true },
    });
    if (!candidate) {
      return INVALID;
    }

    await lockUserRow(tx, candidate.userId);

    const token = await tx.passwordResetToken.findUnique({
      where: { tokenHash: input.tokenHash },
      include: { user: true },
    });
    if (!token || token.user.email !== email) {
      return INVALID;
    }

    const claim = await tx.passwordResetToken.updateMany({
      where: {
        id: token.id,
        userId: token.userId,
        tokenHash: input.tokenHash,
        usedAt: null,
        expiresAt: { gt: input.now },
      },
      data: { usedAt: input.now },
    });
    if (claim.count !== 1) {
      return INVALID;
    }

    await tx.user.update({
      where: { id: token.userId },
      data: {
        password: input.hashedPassword,
        mustResetPassword: false,
      },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: token.userId, usedAt: null },
      data: { usedAt: input.now },
    });

    return { status: "confirmed" };
  });
}
