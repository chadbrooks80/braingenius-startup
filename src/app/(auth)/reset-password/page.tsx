"use client";

import { FormEvent, Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import Button from "@/components/ui/Button";

const resetSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const inputClass =
  "w-full rounded-(--radius-lg) border-2 border-heading/20 bg-surface px-4 py-2.5 text-sm text-text outline-none transition-all duration-(--transition-fast) focus:border-primary";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const result = resetSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, password: result.data.password }),
    });
    const data = await response.json();

    setIsSubmitting(false);

    if (!data.success) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/sign-in");
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
        <div className="w-full max-w-sm rounded-(--radius-2xl) bg-surface/85 p-8 shadow-(--shadow-xl)">
          <div className="text-center">
            <h1 className="font-display text-2xl font-extrabold text-heading">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-muted">Enter a new password below.</p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-semibold text-text">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-semibold text-text"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Resetting..." : "Reset password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
