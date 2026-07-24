"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { saveProfile } from "@/actions/onboarding";

const profileSchema = z.object({
  fName: z.string().min(1, "First name is required"),
  lName: z.string().optional(),
});

export default function ProfileStep() {
  const router = useRouter();
  const [fName, setFName] = useState("");
  const [lName, setLName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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

    if (!profileResult.success) {
      setIsSubmitting(false);
      setError(profileResult.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.refresh();
  }

  return (
    <>
      <div className="text-center">
        <h1 className="font-display text-2xl font-extrabold text-heading">
          Let&apos;s get you started
        </h1>
        <p className="mt-2 text-sm text-muted">
          Please provide the information below.
        </p>
      </div>

      <form className="mx-auto mt-8 max-w-sm space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label htmlFor="fName" className="text-sm font-semibold text-text">
            First name
          </label>
          <Input
            id="fName"
            name="fName"
            type="text"
            autoComplete="given-name"
            value={fName}
            onChange={(e) => setFName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="lName" className="text-sm font-semibold text-text">
            Last name <span className="text-muted">(optional)</span>
          </label>
          <Input
            id="lName"
            name="lName"
            type="text"
            autoComplete="family-name"
            value={lName}
            onChange={(e) => setLName(e.target.value)}
          />
        </div>

        {error && <p className="text-sm font-medium text-danger">{error}</p>}

        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          className="w-full justify-center"
        >
          {isSubmitting ? "Continuing..." : "Continue"}
        </Button>
      </form>
    </>
  );
}
