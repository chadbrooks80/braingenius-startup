"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Eyebrow from "@/components/ui/Eyebrow";
import CheckBadge from "@/components/ui/CheckBadge";
import { continueWithFreeTrial } from "@/actions/onboarding";
import { createCheckoutSession, type CheckoutPlan } from "@/actions/checkout";

export default function PlanStep({ checkoutCanceled }: { checkoutCanceled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(
    checkoutCanceled ? "Checkout was canceled." : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<CheckoutPlan | null>(null);

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

  async function handleFreeTrial() {
    setError(null);
    setIsSubmitting(true);

    const result = await continueWithFreeTrial();

    if (!result.success) {
      setIsSubmitting(false);
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.refresh();
  }

  return (
    <>
      <div className="text-center">
        <Eyebrow>3-day free trial</Eyebrow>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-heading">
          Your trial is ready
        </h1>
        <p className="mt-2 text-sm text-muted">
          Here&apos;s what&apos;s included now, and what you can upgrade to later.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-(--radius-xl) border border-surface/(--alpha-surface) bg-surface p-6 shadow-(--shadow-md)">
          <h3 className="font-display text-lg font-extrabold text-heading">
            Free trial
          </h3>
          <p className="mt-1 text-sm text-muted">3 days, on us.</p>
          <div className="mt-4 flex flex-col gap-2">
            <CheckBadge label="1 word list" />
            <CheckBadge label="1 reading activity" />
            <CheckBadge label="Up to 2 children" />
          </div>
        </div>

        <div className="rounded-(--radius-xl) border border-surface/(--alpha-surface) bg-surface p-6 shadow-(--shadow-md)">
          <h3 className="font-display text-lg font-extrabold text-heading">
            Monthly
          </h3>
          <p className="mt-1 text-sm text-muted">
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
            className="mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-(--alpha-surface-soft)"
          >
            {isCheckoutLoading === "MONTHLY" ? "Starting checkout..." : "Upgrade monthly"}
          </Button>
        </div>

        <div className="rounded-(--radius-xl) border border-surface/(--alpha-surface) bg-surface p-6 shadow-(--shadow-md) sm:col-span-2">
          <h3 className="font-display text-lg font-extrabold text-heading">
            Lifetime
          </h3>
          <p className="mt-1 text-sm text-muted">$149.99 one-time</p>
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
            className="mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-(--alpha-surface-soft)"
          >
            {isCheckoutLoading === "LIFETIME" ? "Starting checkout..." : "Upgrade lifetime"}
          </Button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Additional children: $0.99/month for 3 months then $3.99/month per child, or $69.99
        one-time per child.
      </p>

      {checkoutError && (
        <p className="mt-2 text-center text-sm font-medium text-danger">
          {checkoutError}
        </p>
      )}

      {error && (
        <p className="mt-2 text-center text-sm font-medium text-danger">{error}</p>
      )}

      <Button
        type="button"
        variant="primary"
        disabled={isSubmitting}
        onClick={handleFreeTrial}
        className="mx-auto mt-6 w-full max-w-sm justify-center disabled:cursor-not-allowed disabled:opacity-(--alpha-surface-soft) sm:flex"
      >
        {isSubmitting ? "Continuing..." : "Continue with free trial"}
      </Button>
    </>
  );
}
