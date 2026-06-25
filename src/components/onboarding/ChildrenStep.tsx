"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";
import Button from "@/components/ui/Button";
import { completeOnboarding } from "@/actions/onboarding";
import { OnboardingStep } from "@/generated/prisma";

const childrenSchema = z.object({
  child1Name: z.string().min(1, "Child 1 first name is required"),
  child2Name: z.string().optional(),
});

const inputClass =
  "w-full rounded-(--radius-lg) border-2 border-(--color-border-muted) bg-(--color-white) px-4 py-2.5 text-sm text-(--color-text-primary) outline-none transition-all duration-(--transition-fast) focus:border-(--color-primary-cyan)";

export default function ChildrenStep() {
  const router = useRouter();
  const { update } = useSession();
  const [child1Name, setChild1Name] = useState("");
  const [child2Name, setChild2Name] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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

    await update({ onboardingCompleted: true, onboardingStep: OnboardingStep.COMPLETE });
    router.push("/dashboard");
  }

  return (
    <>
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-(--color-dark)">
          Add your children
        </h1>
        <p className="mt-2 text-sm text-(--color-text-muted)">
          Your trial includes up to 2 children. You can add more later.
        </p>
      </div>

      <form className="mx-auto mt-8 max-w-sm space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="child1Name" className="text-sm font-semibold text-(--color-text-primary)">
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
          <label htmlFor="child2Name" className="text-sm font-semibold text-(--color-text-primary)">
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
  );
}
