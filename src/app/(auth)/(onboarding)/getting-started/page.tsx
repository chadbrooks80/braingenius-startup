"use client";

import { FormEvent, ReactNode, Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";
import Button from "@/components/ui/Button";
import Eyebrow from "@/components/ui/Eyebrow";
import CheckBadge from "@/components/ui/CheckBadge";
import { completeOnboarding, saveProfile } from "@/actions/onboarding";
import { createCheckoutSession, type CheckoutPlan } from "@/actions/checkout";

const profileSchema = z.object({
  fName: z.string().min(1, "First name is required"),
  lName: z.string().optional(),
});

const childrenSchema = z.object({
  child1Name: z.string().min(1, "Child 1 first name is required"),
  child2Name: z.string().optional(),
});

const inputClass =
  "w-full rounded-(--radius-lg) border-2 border-(--color-border-muted) bg-(--color-white) px-4 py-2.5 text-sm text-(--color-text-primary) outline-none transition-all duration-(--transition-fast) focus:border-(--color-primary-cyan)";

type Step = "profile" | "plan" | "children";

function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-(--color-bg-top)">
      <header className="flex h-(--header-height) items-center justify-center">
        <Image
          src="/logo.png"
          alt="BrainGenius.ai"
          height={56}
          width={200}
          loading="eager"
          className="h-[clamp(28px,3.9vw,56px)] w-auto"
        />
      </header>

      <div className="flex flex-1 items-center justify-center px-(--spacing-container) py-10">
        <div className="w-full max-w-2xl rounded-(--radius-2xl) bg-(--color-surface-strong) p-8 shadow-(--shadow-xl)">
          {children}
        </div>
      </div>
    </div>
  );
}

function GettingStartedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();

  const initialStep: Step = searchParams.get("step") === "children" ? "children" : "profile";

  const [step, setStep] = useState<Step>(initialStep);
  const [fName, setFName] = useState("");
  const [lName, setLName] = useState("");
  const [child1Name, setChild1Name] = useState("");
  const [child2Name, setChild2Name] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<CheckoutPlan | null>(null);

  async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const result = profileSchema.safeParse({ fName, lName });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setIsSubmitting(true);
    const profileResult = await saveProfile({
      fName: result.data.fName,
      lName: result.data.lName || undefined,
    });
    setIsSubmitting(false);

    if (!profileResult.success) {
      setError(profileResult.error ?? "Something went wrong. Please try again.");
      return;
    }

    setStep("plan");
  }

  async function handleUpgrade(plan: CheckoutPlan) {
    setCheckoutError(null);
    setIsCheckoutLoading(plan);

    const result = await createCheckoutSession(plan);

    setIsCheckoutLoading(null);

    if (!result.success) {
      setCheckoutError(result.error ?? "Could not start checkout. Please try again.");
      return;
    }

    window.location.href = result.url;
  }

  async function handleChildrenSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const result = childrenSchema.safeParse({ child1Name, child2Name });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setIsSubmitting(true);

    const onboardingResult = await completeOnboarding({
      child1Name: result.data.child1Name,
      child2Name: result.data.child2Name || undefined,
    });

    if (!onboardingResult.success) {
      setIsSubmitting(false);
      setError(onboardingResult.error ?? "Something went wrong. Please try again.");
      return;
    }

    await update({ onboardingCompleted: true });
    router.push("/dashboard");
  }

  return (
    <OnboardingShell>
      {step === "profile" && (
        <>
          <div className="text-center">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-(--color-dark)">
              Let&apos;s get you started
            </h1>
            <p className="mt-2 text-sm text-(--color-text-muted)">
              Please provide the information below.
            </p>
          </div>

          <form className="mx-auto mt-8 max-w-sm space-y-4" onSubmit={handleProfileSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="fName" className="text-sm font-semibold text-(--color-text-primary)">
                First name
              </label>
              <input
                id="fName"
                name="fName"
                type="text"
                autoComplete="given-name"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="lName" className="text-sm font-semibold text-(--color-text-primary)">
                Last name <span className="text-(--color-text-muted)">(optional)</span>
              </label>
              <input
                id="lName"
                name="lName"
                type="text"
                autoComplete="family-name"
                value={lName}
                onChange={(e) => setLName(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm font-medium text-(--color-accent-pink)">{error}</p>}

            <Button type="submit" variant="primary" className="w-full justify-center">
              Continue
            </Button>
          </form>
        </>
      )}

      {step === "plan" && (
        <>
          <div className="text-center">
            <Eyebrow>3-day free trial</Eyebrow>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-extrabold text-(--color-dark)">
              Your trial is ready
            </h1>
            <p className="mt-2 text-sm text-(--color-text-muted)">
              Here&apos;s what&apos;s included now, and what you can upgrade to later.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-(--radius-xl) border border-(--color-border-soft) bg-(--color-white) p-6 shadow-(--shadow-md)">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-extrabold text-(--color-dark)">
                Free trial
              </h3>
              <p className="mt-1 text-sm text-(--color-text-muted)">3 days, on us.</p>
              <div className="mt-4 flex flex-col gap-2">
                <CheckBadge label="1 word list" />
                <CheckBadge label="1 reading activity" />
                <CheckBadge label="Up to 2 children" />
              </div>
            </div>

            <div className="rounded-(--radius-xl) border border-(--color-border-soft) bg-(--color-white) p-6 shadow-(--shadow-md)">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-extrabold text-(--color-dark)">
                Monthly
              </h3>
              <p className="mt-1 text-sm text-(--color-text-muted)">
                $3.99/month for 3 months, then $9.99/month
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <CheckBadge label="Up to 2 children" />
                <CheckBadge label="Access to all words" />
                <CheckBadge label="Unlimited word lists" />
                <CheckBadge label="Unlimited reading activities" />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={isCheckoutLoading !== null}
                onClick={() => handleUpgrade("MONTHLY")}
                className="mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCheckoutLoading === "MONTHLY" ? "Starting checkout..." : "Upgrade monthly"}
              </Button>
            </div>

            <div className="rounded-(--radius-xl) border border-(--color-border-soft) bg-(--color-white) p-6 shadow-(--shadow-md) sm:col-span-2">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-extrabold text-(--color-dark)">
                Lifetime
              </h3>
              <p className="mt-1 text-sm text-(--color-text-muted)">$149.99 one-time</p>
              <div className="mt-4 flex flex-col gap-2">
                <CheckBadge label="Up to 2 children" />
                <CheckBadge label="Access to all words" />
                <CheckBadge label="Unlimited word lists" />
                <CheckBadge label="Unlimited reading activities" />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={isCheckoutLoading !== null}
                onClick={() => handleUpgrade("LIFETIME")}
                className="mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCheckoutLoading === "LIFETIME" ? "Starting checkout..." : "Upgrade lifetime"}
              </Button>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-(--color-text-muted)">
            Additional children: $0.99/month for 3 months then $3.99/month per child, or $69.99
            one-time per child.
          </p>

          {checkoutError && (
            <p className="mt-2 text-center text-sm font-medium text-(--color-accent-pink)">
              {checkoutError}
            </p>
          )}

          <Button
            type="button"
            variant="primary"
            onClick={() => setStep("children")}
            className="mx-auto mt-6 w-full max-w-sm justify-center sm:flex"
          >
            Continue with free trial
          </Button>
        </>
      )}

      {step === "children" && (
        <>
          <div className="text-center">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-(--color-dark)">
              Add your children
            </h1>
            <p className="mt-2 text-sm text-(--color-text-muted)">
              Your trial includes up to 2 children. You can add more later.
            </p>
          </div>

          <form className="mx-auto mt-8 max-w-sm space-y-4" onSubmit={handleChildrenSubmit}>
            <div className="space-y-1.5">
              <label
                htmlFor="child1Name"
                className="text-sm font-semibold text-(--color-text-primary)"
              >
                Child 1 first name
              </label>
              <input
                id="child1Name"
                name="child1Name"
                type="text"
                value={child1Name}
                onChange={(e) => setChild1Name(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="child2Name"
                className="text-sm font-semibold text-(--color-text-primary)"
              >
                Child 2 first name <span className="text-(--color-text-muted)">(optional)</span>
              </label>
              <input
                id="child2Name"
                name="child2Name"
                type="text"
                value={child2Name}
                onChange={(e) => setChild2Name(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm font-medium text-(--color-accent-pink)">{error}</p>}

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Finishing up..." : "Finish setup"}
            </Button>
          </form>
        </>
      )}
    </OnboardingShell>
  );
}

export default function GettingStartedPage() {
  return (
    <Suspense>
      <GettingStartedContent />
    </Suspense>
  );
}