"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { getTrialDates } from "@/lib/subscription";
import {
  generateVerificationCode,
  hashValue,
  minutesFromNow,
  VERIFICATION_CODE_EXPIRY_MINUTES,
} from "@/lib/auth-tokens";
import { sendVerificationCodeEmail } from "@/lib/email";
import { CanonicalEmailSchema } from "@/lib/auth/email-normalization";

const RegisterSchema = z.object({
  email: CanonicalEmailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

export async function registerUser(formData: FormData) {
  const parsed = RegisterSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message,
    };
  }

  const { email, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    // Only create the account when no user currently owns this email. An
    // existing account -- verified or not -- is left completely untouched:
    // no password rehash, no verification reset, no subscription changes.
    if (!existing) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const { trialStartedAt, trialEndsAt } = getTrialDates();

      try {
        await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            role: "PARENT",
            subscription: {
              create: {
                tier: "FREE_TRIAL",
                trialStartedAt,
                trialEndsAt,
              },
            },
          },
        });
      } catch (error) {
        // A concurrent request may have just registered the same email.
        // Treat that race the same as "already exists" instead of letting
        // the unique-constraint error distinguish the two cases.
        const isConcurrentEmailConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === UNIQUE_CONSTRAINT_VIOLATION;
        if (!isConcurrentEmailConflict) {
          throw error;
        }
      }
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Send a verification code whenever this email currently belongs to an
    // unverified account, whether it was just created or already existed.
    // A verified account never receives a new-account email here.
    if (user && !user.emailVerified) {
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
        // The account and code already exist; the user can retry from /verify-email
        // via "Resend code" if the email failed to send.
        console.error("sendVerificationCodeEmail failed:", error);
      }
    }

    // Always return the same accepted shape so the response never reveals
    // whether this email already belonged to an account.
    return { success: true };
  } catch (error) {
    console.error("registerUser failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
