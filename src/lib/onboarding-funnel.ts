import { OnboardingStep } from "@/generated/prisma";
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

/** Decides where a signed-in user should land based on their funnel progress. */
export function getOnboardingRoute(user: {
  onboardingStep: OnboardingStep;
  onboardingCompleted: boolean;
}): string {
  if (user.onboardingCompleted || user.onboardingStep === OnboardingStep.COMPLETE) {
    return "/dashboard";
  }

  if (user.onboardingStep === OnboardingStep.VERIFY_EMAIL) {
    return "/verify-email";
  }

  return "/getting-started";
}

/**
 * Advances a user from their current funnel step to the next one, marking
 * onboarding as completed once the funnel reaches its final step.
 */
export async function advanceOnboardingStep(
  userId: string,
  currentStep: OnboardingStep
): Promise<OnboardingStep> {
  const nextStep = getNextOnboardingStep(currentStep);

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingStep: nextStep,
      onboardingCompleted: nextStep === OnboardingStep.COMPLETE,
    },
  });

  return nextStep;
}
