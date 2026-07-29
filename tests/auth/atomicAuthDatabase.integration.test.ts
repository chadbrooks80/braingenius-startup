import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { hashValue } from "@/lib/auth-tokens";
import {
  confirmPasswordReset,
  issuePasswordResetToken,
} from "@/lib/auth/password-reset";
import { replaceVerificationCode } from "@/lib/auth/verification-code-resend";

function disposableDatabaseSkipReason(): string | false {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return "DATABASE_URL is not configured for an approved disposable database";
  }

  try {
    const parsed = new URL(rawUrl);
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    const databaseName = decodeURIComponent(parsed.pathname.slice(1));
    const isTestNamed = /(^|[_-])(test|testing|tmp|temp|ci)([_-]|$)/i.test(
      databaseName
    );
    if (!isLocalHost || !isTestNamed) {
      return "DATABASE_URL is not an unmistakably local, test-named disposable database";
    }
  } catch {
    return "DATABASE_URL is not parseable as an approved disposable database";
  }

  return false;
}

const skipReason = disposableDatabaseSkipReason();

test(
  "real PostgreSQL serializes same-user auth grants, rolls back, and completes without deadlock",
  { skip: skipReason, timeout: 30_000 },
  async () => {
    const fixtureId = randomUUID();
    const verificationEmail = `atomic-verification-${fixtureId}@example.invalid`;
    const resetEmail = `atomic-reset-${fixtureId}@example.invalid`;
    const createdUserIds: string[] = [];

    try {
      const verificationUser = await prisma.user.create({
        data: {
          email: verificationEmail,
          role: "PARENT",
          onboardingStep: "VERIFY_EMAIL",
        },
      });
      createdUserIds.push(verificationUser.id);
      await prisma.emailVerificationCode.create({
        data: {
          email: verificationEmail,
          codeHash: hashValue("0000"),
          createdAt: new Date(Date.now() - 2 * 60 * 1000),
          expiresAt: new Date(Date.now() + 8 * 60 * 1000),
        },
      });

      const resendResults = await Promise.all([
        replaceVerificationCode(verificationEmail),
        replaceVerificationCode(verificationEmail),
      ]);
      assert.equal(
        resendResults.filter((result) => result.status === "send").length,
        1
      );
      assert.equal(
        await prisma.emailVerificationCode.count({
          where: { email: verificationEmail, usedAt: null },
        }),
        1
      );

      const resetUser = await prisma.user.create({
        data: {
          email: resetEmail,
          password: await bcrypt.hash("old-password-1", 10),
          role: "PARENT",
        },
      });
      createdUserIds.push(resetUser.id);
      const now = new Date();
      const issuanceResults = await Promise.all([
        issuePasswordResetToken({
          rawEmail: resetEmail,
          tokenHash: hashValue(`issue-a-${fixtureId}`),
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
          now,
        }),
        issuePasswordResetToken({
          rawEmail: resetEmail,
          tokenHash: hashValue(`issue-b-${fixtureId}`),
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
          now,
        }),
      ]);
      assert.equal(
        issuanceResults.filter((result) => result.status === "created").length,
        1
      );

      await prisma.passwordResetToken.updateMany({
        where: { userId: resetUser.id },
        data: { usedAt: now },
      });
      const rawTokens = [`confirm-a-${fixtureId}`, `confirm-b-${fixtureId}`];
      await prisma.passwordResetToken.createMany({
        data: rawTokens.map((token) => ({
          userId: resetUser.id,
          tokenHash: hashValue(token),
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        })),
      });
      const proposedPasswords = ["winner-candidate-one", "winner-candidate-two"];
      const proposedHashes = await Promise.all(
        proposedPasswords.map((password) => bcrypt.hash(password, 10))
      );
      const confirmationResults = await Promise.all(
        rawTokens.map((token, index) =>
          confirmPasswordReset({
            rawEmail: resetEmail,
            tokenHash: hashValue(token),
            hashedPassword: proposedHashes[index],
            now: new Date(),
          })
        )
      );
      const winnerIndex = confirmationResults.findIndex(
        (result) => result.status === "confirmed"
      );
      assert.equal(
        confirmationResults.filter((result) => result.status === "confirmed")
          .length,
        1
      );
      const resetUserAfter = await prisma.user.findUniqueOrThrow({
        where: { id: resetUser.id },
        select: { password: true },
      });
      assert.ok(
        await bcrypt.compare(
          proposedPasswords[winnerIndex],
          resetUserAfter.password ?? ""
        )
      );

      const rollbackProviderAccountId = `rollback-${fixtureId}`;
      await assert.rejects(
        prisma.$transaction(async (tx) => {
          await tx.account.create({
            data: {
              userId: resetUser.id,
              type: "oauth",
              provider: "atomicity-harness",
              providerAccountId: rollbackProviderAccountId,
            },
          });
          throw new Error("intentional disposable-database rollback proof");
        })
      );
      assert.equal(
        await prisma.account.count({
          where: {
            provider: "atomicity-harness",
            providerAccountId: rollbackProviderAccountId,
          },
        }),
        0
      );
    } finally {
      await prisma.emailVerificationCode.deleteMany({
        where: { email: verificationEmail },
      });
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    }
  }
);
