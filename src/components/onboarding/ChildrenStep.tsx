"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import PasswordInput from "@/components/ui/PasswordInput";
import {
  checkUsernameAvailability,
  createChildAccount,
  finishChildrenStep,
  suggestUsernames,
} from "@/actions/onboarding";
import { OnboardingStep } from "@/generated/prisma";

const MAX_CHILDREN = 2;

const createChildSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  username: z.string().min(3).regex(/^[a-z0-9]+$/, "Lowercase letters and numbers only"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  mustResetPassword: z.boolean(),
});

const inputClass =
  "w-full rounded-(--radius-lg) border-2 border-heading/(--alpha-soft) bg-surface px-4 py-2.5 text-sm text-text outline-none transition-all duration-(--transition-fast) focus:border-primary";

type ChildSummary = { id: string; name: string; username: string };

type UsernameStatus = "idle" | "checking" | "available" | "taken";

export default function ChildrenStep() {
  const router = useRouter();
  const { update } = useSession();
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [activeSlot, setActiveSlot] = useState<1 | 2 | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  async function finishOnboarding() {
    setFinishError(null);
    setIsFinishing(true);

    const result = await finishChildrenStep();

    if (!result.success) {
      setIsFinishing(false);
      setFinishError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    await update({ onboardingCompleted: true, onboardingStep: OnboardingStep.COMPLETE });
    router.push("/dashboard");
  }

  function handleChildCreated(child: ChildSummary) {
    setChildren((prev) => [...prev, child]);
    setActiveSlot(null);
  }

  return (
    <>
      <div className="text-center">
        <h1 className="font-display text-2xl font-extrabold text-heading">
          Your Subscription Includes Adding Up to Two Children
        </h1>
        <p className="mt-2 text-sm text-muted">
          You can add, edit, or remove children later from Account Settings.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-sm space-y-4">
        {[1, 2].map((slot) => {
          const child = children[slot - 1];
          const locked = slot === 2 && children.length < 1;

          if (child) {
            return (
              <div
                key={slot}
                className="flex items-center gap-3 rounded-(--radius-lg) border-2 border-heading/(--alpha-soft) bg-surface px-4 py-3"
              >
                <Check size={18} className="shrink-0 text-success" />
                <div>
                  <p className="text-sm font-semibold text-text">{child.name}</p>
                  <p className="text-xs text-muted">User ID: {child.username}</p>
                </div>
              </div>
            );
          }

          return (
            <Button
              key={slot}
              type="button"
              variant="secondary"
              disabled={locked}
              onClick={() => setActiveSlot(slot as 1 | 2)}
              className="w-full justify-center disabled:cursor-not-allowed disabled:opacity-(--alpha-surface-soft)"
            >
              + Add {slot === 1 ? "First" : "Second"} Child
            </Button>
          );
        })}

        {finishError && <p className="text-sm font-medium text-danger">{finishError}</p>}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            disabled={isFinishing}
            onClick={finishOnboarding}
            className="flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-(--alpha-surface-soft)"
          >
            Skip for now
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={isFinishing}
            onClick={finishOnboarding}
            className="flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-(--alpha-surface-soft)"
          >
            {isFinishing ? "Finishing up..." : "Finish setup"}
          </Button>
        </div>
      </div>

      <Modal
        open={activeSlot !== null}
        onClose={() => setActiveSlot(null)}
        title={`Add ${activeSlot === 1 ? "First" : "Second"} Child`}
      >
        {activeSlot !== null && (
          <AddChildForm
            onCreated={handleChildCreated}
            childCount={children.length}
            maxChildren={MAX_CHILDREN}
          />
        )}
      </Modal>
    </>
  );
}

function AddChildForm({
  onCreated,
  childCount,
  maxChildren,
}: {
  onCreated: (child: ChildSummary) => void;
  childCount: number;
  maxChildren: number;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAutoGenerate() {
    const base = firstName || "student";
    const result = await suggestUsernames(base);
    setSuggestions(result.suggestions);
    if (result.suggestions.length > 0) {
      setUsername(result.suggestions[0]);
      setUsernameStatus("available");
    }
  }

  async function handleUsernameBlur() {
    if (username.length < 3) return;

    setUsernameStatus("checking");
    const result = await checkUsernameAvailability(username);

    if (result.available) {
      setUsernameStatus("available");
      setSuggestions([]);
      return;
    }

    setUsernameStatus("taken");
    const suggested = await suggestUsernames(username);
    setSuggestions(suggested.suggestions);
  }

  function handleSelectSuggestion(suggestion: string) {
    setUsername(suggestion);
    setUsernameStatus("available");
    setSuggestions([]);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (childCount >= maxChildren) {
      setError("You can only add up to 2 children.");
      return;
    }

    const result = createChildSchema.safeParse({
      firstName,
      lastName: lastName || undefined,
      username,
      password,
      mustResetPassword,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setIsSubmitting(true);

    const creationResult = await createChildAccount(result.data);

    if (!creationResult.success || !creationResult.data) {
      setIsSubmitting(false);
      setError(creationResult.error ?? "Something went wrong. Please try again.");
      return;
    }

    setIsSubmitting(false);
    onCreated(creationResult.data);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label htmlFor="firstName" className="text-sm font-semibold text-text">
          First name
        </label>
        <input
          id="firstName"
          name="firstName"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="lastName" className="text-sm font-semibold text-text">
          Last name <span className="text-muted">(optional)</span>
        </label>
        <input
          id="lastName"
          name="lastName"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="username" className="text-sm font-semibold text-text">
            User ID
          </label>
          <button
            type="button"
            onClick={handleAutoGenerate}
            className="cursor-pointer text-xs font-semibold text-primary hover:underline"
          >
            Auto Generate
          </button>
        </div>
        <input
          id="username"
          name="username"
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value.toLowerCase());
            setUsernameStatus("idle");
          }}
          onBlur={handleUsernameBlur}
          className={inputClass}
        />
        {usernameStatus === "checking" && (
          <p className="text-xs text-muted">Checking availability...</p>
        )}
        {usernameStatus === "available" && (
          <p className="text-xs font-medium text-success">Available</p>
        )}
        {usernameStatus === "taken" && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-danger">
              That User ID is taken. Try one of these:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="cursor-pointer rounded-(--radius-full) border-2 border-heading/(--alpha-soft) px-3 py-1 text-xs font-semibold text-text transition-colors duration-(--transition-fast) hover:border-primary"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-semibold text-text">
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={mustResetPassword}
          onChange={(e) => setMustResetPassword(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Child must create a new password after logging in
      </label>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      <Button
        type="submit"
        variant="primary"
        disabled={isSubmitting}
        className="w-full justify-center disabled:cursor-not-allowed disabled:opacity-(--alpha-surface-soft)"
      >
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
