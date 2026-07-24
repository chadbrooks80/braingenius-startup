"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { registerUser } from "@/actions/register";

const signUpSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const codeSchema = z.object({
  code: z.string().length(4, "Enter the 4-digit code"),
});

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v2.97h3.86c2.26-2.08 3.56-5.14 3.56-8.79z"
      />
      <path
        fill="currentColor"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.86-2.97c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.07C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="currentColor"
        d="M5.27 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.62H1.27A11.96 11.96 0 0 0 0 12c0 1.93.46 3.76 1.27 5.38l4-3.07z"
      />
      <path
        fill="currentColor"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.78l3.43-3.43C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.27 6.62l4 3.07c.95-2.85 3.6-4.94 6.73-4.94z"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        className="opacity-(--alpha-soft)"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-(--alpha-surface)"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

type Phase = "form" | "verify";

export default function SignUpPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("form");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleGoogleSignUp() {
    setIsGoogleSubmitting(true);
    await signIn("google", { callbackUrl: "/getting-started" });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const result = signUpSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("email", result.data.email);
    formData.set("password", result.data.password);

    const registration = await registerUser(formData);

    setIsSubmitting(false);

    if (!registration.success) {
      setError(registration.error ?? "Something went wrong. Please try again.");
      return;
    }

    setPhase("verify");
  }

  async function handleVerifySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setVerifyError(null);
    setResendMessage(null);

    const result = codeSchema.safeParse({ code });
    if (!result.success) {
      setVerifyError(result.error.issues[0]?.message ?? "Invalid code");
      return;
    }

    setIsVerifying(true);

    const response = await fetch("/api/auth/verify-email-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: result.data.code }),
    });
    const data = await response.json();

    if (!data.success) {
      setIsVerifying(false);
      setVerifyError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    // The password is still held in memory from the form above, so we can
    // sign the user straight in instead of sending them back to /sign-in.
    const signInResult = await signIn("credentials", {
      username: email,
      password,
      redirect: false,
    });

    if (signInResult?.error) {
      router.push("/sign-in?verified=1");
      return;
    }

    router.push("/getting-started");
    // isVerifying intentionally stays true here; the page is navigating away.
  }

  async function handleResend() {
    setVerifyError(null);
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
      setVerifyError(data?.error ?? "Something went wrong. Please try again.");
      return;
    }

    setResendMessage("If your account needs verification, we sent a new code.");
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
          {phase === "form" && (
            <>
              <div className="text-center">
                <h1 className="font-display text-2xl font-extrabold text-heading">
                  Create your account
                </h1>
                <p className="mt-2 text-sm text-muted">
                  Start your 3-day free trial with BrainGenius AI
                </p>
              </div>

              <Button
                type="button"
                variant="oauth"
                onClick={handleGoogleSignUp}
                disabled={isGoogleSubmitting}
                className="mt-8 w-full justify-center"
              >
                {isGoogleSubmitting ? (
                  "Signing in..."
                ) : (
                  <>
                    <GoogleIcon />
                    Continue with Google
                  </>
                )}
              </Button>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-heading/(--alpha-soft)" />
                <span className="text-xs font-semibold uppercase tracking-(--tracking-label) text-muted">
                  or
                </span>
                <span className="h-px flex-1 bg-heading/(--alpha-soft)" />
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-semibold text-text">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="text-sm font-semibold text-text"
                  >
                    Password
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error && <p className="text-sm font-medium text-danger">{error}</p>}

                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  className="w-full justify-center"
                >
                  {isSubmitting ? "Creating account..." : "Create account"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted">
                Already have an account?{" "}
                <a href="/sign-in" className="font-semibold text-link">
                  Sign in
                </a>
              </p>
            </>
          )}

          {phase === "verify" && (
            <>
              <div className="text-center">
                <h1 className="font-display text-2xl font-extrabold text-heading">
                  Verify your email
                </h1>
                <p className="mt-2 text-sm text-muted">
                  We sent a 4-digit verification code to {email}.
                </p>
              </div>

              <form className="mt-8 space-y-4" onSubmit={handleVerifySubmit}>
                <div className="space-y-1.5">
                  <label htmlFor="code" className="text-sm font-semibold text-text">
                    Verification code
                  </label>
                  <Input
                    variant="code"
                    id="code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                {verifyError && (
                  <p className="text-sm font-medium text-danger">{verifyError}</p>
                )}
                {resendMessage && (
                  <p className="text-sm font-medium text-muted">{resendMessage}</p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  disabled={isVerifying}
                  className="w-full justify-center"
                >
                  {isVerifying && <Spinner />}
                  {isVerifying ? "Verifying..." : "Verify email"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted">
                Didn&apos;t get a code?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="font-semibold text-link disabled:cursor-not-allowed disabled:opacity-(--alpha-surface-soft)"
                >
                  {isResending ? "Sending..." : "Resend code"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
