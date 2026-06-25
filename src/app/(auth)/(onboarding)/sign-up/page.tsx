"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Button from "@/components/ui/Button";
import { registerUser } from "@/actions/register";

const signUpSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const inputClass =
  "w-full rounded-(--radius-lg) border-2 border-(--color-border-muted) bg-(--color-white) px-4 py-2.5 text-sm text-(--color-text-primary) outline-none transition-all duration-(--transition-fast) focus:border-(--color-primary-cyan)";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v2.97h3.86c2.26-2.08 3.56-5.14 3.56-8.79z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.86-2.97c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.07C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.62H1.27A11.96 11.96 0 0 0 0 12c0 1.93.46 3.76 1.27 5.38l4-3.07z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.78l3.43-3.43C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.27 6.62l4 3.07c.95-2.85 3.6-4.94 6.73-4.94z"
      />
    </svg>
  );
}

export default function SignUpPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

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

    router.push(`/verify-email?email=${encodeURIComponent(result.data.email)}`);
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
              Create your account
            </h1>
            <p className="mt-2 text-sm text-(--color-text-muted)">
              Start your 3-day free trial with BrainGenius AI
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleGoogleSignUp}
            disabled={isGoogleSubmitting}
            className="mt-8 w-full justify-center bg-(--color-white) disabled:cursor-not-allowed disabled:opacity-60"
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
            <span className="h-px flex-1 bg-(--color-border-muted)" />
            <span className="text-xs font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)">
              or
            </span>
            <span className="h-px flex-1 bg-(--color-border-muted)" />
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
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

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-semibold text-(--color-text-primary)">
                Password
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

            {error && <p className="text-sm font-medium text-(--color-accent-pink)">{error}</p>}

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-(--color-text-muted)">
            Already have an account?{" "}
            <a href="/sign-in" className="font-semibold text-(--color-primary-cyan)">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}