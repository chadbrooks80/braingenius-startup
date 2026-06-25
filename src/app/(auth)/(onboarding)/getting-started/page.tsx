import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/db";
import { OnboardingStep } from "@/generated/prisma";
import { advanceOnboardingStep, getOnboardingRoute } from "@/lib/onboarding-funnel";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import WelcomeVideoStep from "@/components/onboarding/WelcomeVideoStep";
import ProfileStep from "@/components/onboarding/ProfileStep";
import PlanStep from "@/components/onboarding/PlanStep";
import ChildrenStep from "@/components/onboarding/ChildrenStep";

type GettingStartedPageProps = {
  searchParams: Promise<{ checkout?: string }>;
};

export default async function GettingStartedPage({ searchParams }: GettingStartedPageProps) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

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

  const { checkout } = await searchParams;
  let step: OnboardingStep = user.onboardingStep;

  // The success_url from createCheckoutSession lands back here once Stripe
  // confirms payment; treat that as completing the plan step automatically.
  if (step === OnboardingStep.PLAN && checkout === "success") {
    step = await advanceOnboardingStep(userId, OnboardingStep.PLAN);
    redirect("/getting-started");
  }

  return (
    <OnboardingShell>
      {step === OnboardingStep.WELCOME_VIDEO && <WelcomeVideoStep />}
      {step === OnboardingStep.PROFILE && <ProfileStep />}
      {step === OnboardingStep.PLAN && <PlanStep checkoutCanceled={checkout === "canceled"} />}
      {step === OnboardingStep.CHILDREN && <ChildrenStep />}
    </OnboardingShell>
  );
}
