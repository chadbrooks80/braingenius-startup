"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";
import Button from "@/components/ui/Button";
import PasswordInput from "@/components/ui/PasswordInput";
import { submitRequiredPasswordReset } from "@/actions/required-password-reset";
import { handleOnboardingRecovery } from "@/lib/onboarding-client";

const resetSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function RequiredPasswordResetForm() {
  const router = useRouter();
  const { update } = useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const result = resetSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setIsSubmitting(true);
    const response = await submitRequiredPasswordReset({
      currentPassword: result.data.currentPassword,
      newPassword: result.data.newPassword,
      confirmNewPassword: result.data.confirmPassword,
    });
    setIsSubmitting(false);

    if (handleOnboardingRecovery(response, router)) {
      return;
    }

    if (response.status === "error") {
      setError(response.error);
      return;
    }

    // Prevent the completed form from resubmitting during navigation, and
    // re-read the now-cleared flag from the database before leaving. Replace
    // (not push) so Back can't return to this completed reset form.
    setIsDone(true);
    await update();
    router.replace(response.data.redirectTo);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
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

      <div className="flex flex-1 items-center justify-center px-(--spacing-container)">
        <div className="w-full max-w-sm rounded-(--radius-2xl) bg-surface/(--alpha-surface-strong) p-8 shadow-(--shadow-xl)">
          <div className="text-center">
            <h1 className="font-display text-2xl font-extrabold text-heading">
              Set a new password
            </h1>
            <p className="mt-2 text-sm text-muted">
              You need to create a new password before continuing.
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="currentPassword" className="text-sm font-semibold text-text">
                Current password
              </label>
              <PasswordInput
                id="currentPassword"
                name="currentPassword"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isDone}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="newPassword" className="text-sm font-semibold text-text">
                New password
              </label>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isDone}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-semibold text-text">
                Confirm new password
              </label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isDone}
              />
            </div>

            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || isDone}
              className="w-full justify-center"
            >
              {isSubmitting ? "Updating..." : "Set new password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
