import "server-only";
import { OnboardingStep, Prisma, UserRole } from "@/generated/prisma";
import prisma from "@/lib/db";

/**
 * Single source of truth for funnel step order. Adding a new step (e.g. a
 * future welcome video variant) means inserting it here only.
 */
export const ONBOARDING_STEP_ORDER: OnboardingStep[] = [
  OnboardingStep.VERIFY_EMAIL,
  OnboardingStep.WELCOME_VIDEO,
  OnboardingStep.PROFILE,
  OnboardingStep.PLAN,
  OnboardingStep.CHILDREN,
  OnboardingStep.COMPLETE,
];

export function getNextOnboardingStep(step: OnboardingStep): OnboardingStep {
  const index = ONBOARDING_STEP_ORDER.indexOf(step);
  return ONBOARDING_STEP_ORDER[Math.min(index + 1, ONBOARDING_STEP_ORDER.length - 1)];
}

/**
 * Decides where a signed-in user should land based on their funnel progress.
 * A CHILD account is never routed into the parent verify-email/onboarding
 * funnel: its onboardingStep/onboardingCompleted default to the same
 * "incomplete" shape as a brand-new parent, but that default has no meaning
 * for a child account, which is created directly by its parent and never
 * progresses through these steps itself.
 */
export function getOnboardingRoute(user: {
  role: UserRole | null;
  onboardingStep: OnboardingStep;
  onboardingCompleted: boolean;
}): string {
  if (user.role === UserRole.CHILD) {
    return "/dashboard";
  }

  if (user.onboardingCompleted || user.onboardingStep === OnboardingStep.COMPLETE) {
    return "/dashboard";
  }

  if (user.onboardingStep === OnboardingStep.VERIFY_EMAIL) {
    return "/verify-email";
  }

  return "/getting-started";
}

/**
 * Database-authoritative result contract shared by every onboarding Server
 * Action and route. Callers must handle every branch: a caller-supplied step
 * or claim is never enough on its own to reach "success".
 */
export type OnboardingActionResult<T = undefined> =
  | { status: "success"; data: T }
  | { status: "recovery"; redirectTo: string }
  | { status: "unauthenticated" }
  | { status: "error"; error: string };

export function onboardingSuccess<T>(data: T): OnboardingActionResult<T> {
  return { status: "success", data };
}

export function onboardingError(error: string): OnboardingActionResult<never> {
  return { status: "error", error };
}

export const ONBOARDING_UNAUTHENTICATED: OnboardingActionResult<never> = {
  status: "unauthenticated",
};

/**
 * Reads only the minimum state (role + step + completion) needed to route a
 * caller whose mutation was rejected as stale, duplicated, out of order, or
 * already completed. Never used to authorize a write.
 */
async function resolveRecoveryRoute(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, onboardingStep: true, onboardingCompleted: true },
  });

  if (!user) {
    return "/sign-in";
  }

  return getOnboardingRoute(user);
}

/**
 * Advances a signed-in parent from `fromStep` to the next funnel step, but
 * only when the database still says the account is a `PARENT`, currently on
 * `fromStep`, and not yet completed. The match and the write happen in one
 * conditional `updateMany`, so a stale, duplicated, or concurrent caller can
 * never move the funnel: an unmatched call always reports zero rows and
 * changes nothing. `extraData` lets a caller (e.g. profile) persist other
 * fields atomically with the same conditional write.
 */
export async function advanceParentOnboardingStep(
  userId: string,
  fromStep: OnboardingStep,
  extraData?: Prisma.UserUpdateManyMutationInput
): Promise<OnboardingActionResult<undefined>> {
  const nextStep = getNextOnboardingStep(fromStep);

  const { count } = await prisma.user.updateMany({
    where: {
      id: userId,
      role: UserRole.PARENT,
      onboardingStep: fromStep,
      onboardingCompleted: false,
    },
    data: {
      ...extraData,
      onboardingStep: nextStep,
      onboardingCompleted: nextStep === OnboardingStep.COMPLETE,
    },
  });

  if (count === 1) {
    return onboardingSuccess(undefined);
  }

  return { status: "recovery", redirectTo: await resolveRecoveryRoute(userId) };
}

/**
 * Gate for onboarding actions that read or write CHILDREN-step data without
 * themselves advancing the funnel (username lookup/suggestion, child
 * creation). Confirms the signed-in user is currently an authoritative
 * database `PARENT` on `requiredStep` with incomplete onboarding. This is a
 * read-then-check gate, not a substitute for a conditional write: a caller
 * that also mutates shared, limited state (e.g. the two-child limit) must
 * re-verify the same conditions inside its own transaction/lock.
 */
export async function requireParentAtStep(
  userId: string,
  requiredStep: OnboardingStep
): Promise<{ authorized: true } | OnboardingActionResult<never>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, onboardingStep: true, onboardingCompleted: true },
  });

  if (!user) {
    return ONBOARDING_UNAUTHENTICATED;
  }

  if (user.role !== UserRole.PARENT || user.onboardingStep !== requiredStep || user.onboardingCompleted) {
    return { status: "recovery", redirectTo: getOnboardingRoute(user) };
  }

  return { authorized: true };
}
