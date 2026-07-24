"use client";

import { FormEvent, Suspense, useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const credentialsSchema = z.object({
  username: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
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

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Default into /dashboard; proxy.ts redirects to /getting-started if onboarding isn't complete.
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const justVerified = searchParams.get("verified") === "1";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    setIsGoogleSubmitting(true);
    await signIn("google", { callbackUrl });
  }

  async function handleCredentialsSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const result = credentialsSchema.safeParse({ username, password });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setIsSubmitting(true);
    const response = await signIn("credentials", {
      username: result.data.username,
      password: result.data.password,
      redirect: false,
      callbackUrl,
    });
    setIsSubmitting(false);

    if (response?.error) {
      setError(
        response.error === "EMAIL_NOT_VERIFIED"
          ? "Please verify your email before signing in."
          : "Invalid email/username or password"
      );
      return;
    }

    router.push(callbackUrl);
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
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted">
              Sign in to continue to BrainGenius AI
            </p>
          </div>

          {justVerified && (
            <p className="mt-4 text-center text-sm font-medium text-primary-strong">
              Your email is verified. You can now sign in.
            </p>
          )}

          <Button
            type="button"
            variant="oauth"
            onClick={handleGoogleSignIn}
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

          <form className="space-y-4" onSubmit={handleCredentialsSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-semibold text-text">
                Email or username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-semibold text-text">
                  Password
                </label>
                <a href="/forgot-password" className="text-sm font-semibold text-link">
                  Forgot password?
                </a>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
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
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
