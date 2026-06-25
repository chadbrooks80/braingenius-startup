"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { completeWelcomeVideoStep } from "@/actions/onboarding";

export default function WelcomeVideoStep() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue() {
    setError(null);
    setIsSubmitting(true);

    const result = await completeWelcomeVideoStep();

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
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-(--color-dark)">
          Welcome to BrainGenius.ai
        </h1>
        <p className="mt-2 text-sm text-(--color-text-muted)">
          Watch a quick intro before we set up your account.
        </p>
      </div>

      <div className="mx-auto mt-8 aspect-video w-full max-w-xl overflow-hidden rounded-(--radius-xl) border border-(--color-border-soft) bg-(--color-white)">
        <iframe
          className="h-full w-full"
          src="https://www.youtube.com/embed/tCDvOQI3pco?start=4"
          title="Welcome to BrainGenius.ai"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {error && (
        <p className="mt-4 text-center text-sm font-medium text-(--color-accent-pink)">{error}</p>
      )}

      <Button
        type="button"
        variant="primary"
        disabled={isSubmitting}
        onClick={handleContinue}
        className="mx-auto mt-6 w-full max-w-sm justify-center disabled:cursor-not-allowed disabled:opacity-60 sm:flex"
      >
        {isSubmitting ? "Continuing..." : "Continue"}
      </Button>
    </>
  );
}
