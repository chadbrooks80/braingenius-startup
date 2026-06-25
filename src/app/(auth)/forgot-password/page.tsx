"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { z } from "zod";
import Button from "@/components/ui/Button";

const emailSchema = z.object({
  email: z.email("Invalid email address"),
});

const inputClass =
  "w-full rounded-(--radius-lg) border-2 border-(--color-border-muted) bg-(--color-white) px-4 py-2.5 text-sm text-(--color-text-primary) outline-none transition-all duration-(--transition-fast) focus:border-(--color-primary-cyan)";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setIsSubmitting(true);

    await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: result.data.email }),
    });

    setIsSubmitting(false);
    setSubmitted(true);
  }

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

      <div className="flex flex-1 items-center justify-center px-(--spacing-container)">
        <div className="w-full max-w-sm rounded-(--radius-2xl) bg-(--color-surface-strong) p-8 shadow-(--shadow-xl)">
          <div className="text-center">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-(--color-dark)">
              Forgot your password?
            </h1>
            <p className="mt-2 text-sm text-(--color-text-muted)">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {submitted ? (
            <p className="mt-8 text-center text-sm font-medium text-(--color-text-primary)">
              If an account exists for that email, we sent a reset link.
            </p>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-semibold text-(--color-text-primary)">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {isSubmitting ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-(--color-text-muted)">
            <a href="/sign-in" className="font-semibold text-(--color-primary-cyan)">
              Back to sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
