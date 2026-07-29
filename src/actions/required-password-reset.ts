"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/db";
import {
  onboardingError,
  onboardingSuccess,
  ONBOARDING_UNAUTHENTICATED,
  type OnboardingActionResult,
} from "@/lib/onboarding-funnel";
import { getAccountAccessRoute } from "@/lib/auth/account-access";

const ResetSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type ResetInput = z.infer<typeof ResetSchema>;

// One generic message for every security-sensitive rejection (wrong current
// password, new password identical to current, or a stale/concurrent
// update) so the response never reveals which specific check failed.
const GENERIC_REJECTION = onboardingError(
  "Your current password is incorrect, or the new password is not valid. Please try again."
);

async function resolveCurrentDestination(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, mustResetPassword: true, onboardingCompleted: true, onboardingStep: true },
  });

  if (!user) {
    return "/sign-in";
  }

  return getAccountAccessRoute(user);
}

/**
 * Completes a required password reset for the signed-in caller. Every check
 * re-reads the authenticated session and database; nothing from the client
 * beyond the two password fields is trusted. The password hash and the
 * mustResetPassword flag change together in one conditional update, so a
 * stale or concurrent submission can never leave them out of sync.
 */
export async function submitRequiredPasswordReset(
  input: ResetInput
): Promise<OnboardingActionResult<{ redirectTo: string }>> {
  const parsed = ResetSchema.safeParse(input);

  if (!parsed.success) {
    return onboardingError(parsed.error.issues[0].message);
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return ONBOARDING_UNAUTHENTICATED;
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        password: true,
        mustResetPassword: true,
        role: true,
        onboardingCompleted: true,
        onboardingStep: true,
      },
    });

    if (!user) {
      return ONBOARDING_UNAUTHENTICATED;
    }

    // Not (or no longer) eligible: already cleared by an earlier successful
    // request, or the account has no credentials password to verify against.
    // Route to the current authoritative destination instead of running the
    // security checks below.
    if (!user.mustResetPassword || !user.password) {
      return { status: "recovery", redirectTo: getAccountAccessRoute(user) };
    }

    const currentMatches = await bcrypt.compare(currentPassword, user.password);
    if (!currentMatches) {
      return GENERIC_REJECTION;
    }

    const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
    if (isSameAsCurrent) {
      return GENERIC_REJECTION;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { count } = await prisma.user.updateMany({
      where: { id: userId, mustResetPassword: true },
      data: { password: hashedPassword, mustResetPassword: false },
    });

    if (count !== 1) {
      // A concurrent request already changed this account's reset state.
      return { status: "recovery", redirectTo: await resolveCurrentDestination(userId) };
    }

    return onboardingSuccess({
      redirectTo: getAccountAccessRoute({ ...user, mustResetPassword: false }),
    });
  } catch (error) {
    console.error("submitRequiredPasswordReset failed:", error);
    return onboardingError("Something went wrong. Please try again.");
  }
}
