"use client";

import { FormEvent, Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import Button from "@/components/ui/Button";

const codeSchema = z.object({
  code: z.string().length(4, "Enter the 4-digit code"),
});

const inputClass =
  "w-full rounded-(--radius-lg) border-2 border-(--color-border-muted) bg-(--color-white) px-4 py-2.5 text-center text-lg tracking-(--tracking-label) text-(--color-text-primary) outline-none transition-all duration-(--transition-fast) focus:border-(--color-primary-cyan)";

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResendMessage(null);

    const result = codeSchema.safeParse({ code });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid code");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/auth/verify-email-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: result.data.code }),
    });
    const data = await response.json();

    if (!data.success) {
      setIsSubmitting(false);
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/sign-in?verified=1");
    // isSubmitting intentionally stays true here; the page is navigating away.
  }

  async function handleResend() {
    setError(null);
    setResendMessage(null);
    setIsResending(true);

    const response = await fetch("/api/auth/resend-verification-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => null);

    setIsResending(false);

    if (!response.ok || !data?.success) {
      setError(data?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setResendMessage("If your account needs verification, we sent a new code.");
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
            <h1 className="font-display text-2xl font-extrabold text-(--color-dark)">
              Verify your email
            </h1>
            <p className="mt-2 text-sm text-(--color-text-muted)">
              We sent a 4-digit verification code to your email.
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="code" className="text-sm font-semibold text-(--color-text-primary)">
                Verification code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm font-medium text-(--color-accent-pink)">{error}</p>}
            {resendMessage && (
              <p className="text-sm font-medium text-(--color-text-muted)">{resendMessage}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <Spinner />}
              {isSubmitting ? "Verifying..." : "Verify email"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-(--color-text-muted)">
            Didn&apos;t get a code?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="font-semibold text-(--color-primary-cyan) disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResending ? "Sending..." : "Resend code"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
