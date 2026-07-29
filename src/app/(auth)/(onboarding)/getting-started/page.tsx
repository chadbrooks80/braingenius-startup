import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/db";
import { OnboardingStep } from "@/generated/prisma";
import { advanceParentOnboardingStep, getOnboardingRoute } from "@/lib/onboarding-funnel";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import WelcomeVideoStep from "@/components/onboarding/WelcomeVideoStep";
import ProfileStep from "@/components/onboarding/ProfileStep";
import PlanStep from "@/components/onboarding/PlanStep";
import ChildrenStep from "@/components/onboarding/ChildrenStep";
import { confirmPaidCheckoutForUser } from "@/lib/billing/stripe-state";

type GettingStartedPageProps = {
  searchParams: Promise<{
    checkout?: string | string[];
    session_id?: string | string[];
  }>;
};

export default async function GettingStartedPage({ searchParams }: GettingStartedPageProps) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    redirect("/sign-in");
  }

  const targetRoute = getOnboardingRoute({
    onboardingCompleted: user.onboardingCompleted,
    onboardingStep: user.onboardingStep,
  });

  if (targetRoute !== "/getting-started") {
    redirect(targetRoute);
  }

  const query = await searchParams;
  const checkout = typeof query.checkout === "string" ? query.checkout : undefined;
  const checkoutSessionId =
    typeof query.session_id === "string" ? query.session_id : undefined;
  const step: OnboardingStep = user.onboardingStep;
  let checkoutFeedback: "canceled" | "unconfirmed" | null =
    checkout === "canceled" ? "canceled" : null;

  if (step === OnboardingStep.PLAN && checkout === "success") {
    const checkoutResult = checkoutSessionId
      ? await confirmPaidCheckoutForUser({ checkoutSessionId, userId })
      : { status: "rejected" as const };

    if (checkoutResult.status === "confirmed") {
      const result = await advanceParentOnboardingStep(userId, OnboardingStep.PLAN);

      if (result.status === "unauthenticated") {
        redirect("/sign-in");
      }

      if (result.status === "recovery") {
        redirect(result.redirectTo);
      }

      if (result.status === "success") {
        redirect("/getting-started");
      }
    }

    checkoutFeedback = "unconfirmed";
  }

  return (
    <OnboardingShell>
      {step === OnboardingStep.WELCOME_VIDEO && <WelcomeVideoStep />}
      {step === OnboardingStep.PROFILE && <ProfileStep />}
      {step === OnboardingStep.PLAN && (
        <PlanStep checkoutFeedback={checkoutFeedback} />
      )}
      {step === OnboardingStep.CHILDREN && <ChildrenStep />}
    </OnboardingShell>
  );
}
