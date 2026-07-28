import type { OnboardingActionResult } from "@/lib/onboarding-funnel";

/**
 * The subset of `useRouter()` the onboarding client helpers need. Matches
 * `next/navigation`'s `AppRouterInstance` structurally, so the real router
 * satisfies this without a cast.
 */
export type OnboardingNavigationRouter = {
  replace: (href: string) => void;
  refresh: () => void;
  push: (href: string) => void;
};

/**
 * Shared handling for the `recovery` and `unauthenticated` branches every
 * onboarding client component receives from an `OnboardingActionResult`. A
 * `recovery` result means the database rejected the mutation (stale, wrong
 * step, already completed, etc.) and already computed the safe destination:
 * the caller must navigate there and refresh, never retry the same
 * mutation. Returns whether the result was handled, so callers proceed to
 * their own `success`/`error` handling only when this returns `false`.
 */
export function handleOnboardingRecovery<T>(
  result: OnboardingActionResult<T>,
  router: Pick<OnboardingNavigationRouter, "replace" | "refresh">
): result is Extract<OnboardingActionResult<T>, { status: "recovery" } | { status: "unauthenticated" }> {
  if (result.status === "recovery") {
    router.replace(result.redirectTo);
    router.refresh();
    return true;
  }

  if (result.status === "unauthenticated") {
    router.replace("/sign-in");
    return true;
  }

  return false;
}

/**
 * Result of the availability-then-suggestion sequence below. `recovery` and
 * `unauthenticated` mean the helper already navigated; `error` preserves the
 * existing inline-error handling. `available`/`taken` are the two real
 * outcomes the caller renders.
 */
export type UsernameAvailabilityResult =
  | { status: "available" }
  | { status: "taken"; suggestions: string[] }
  | { status: "recovery"; redirectTo: string }
  | { status: "unauthenticated" }
  | { status: "error"; error: string };

/**
 * Orchestrates the full username-blur boundary: check availability, and when
 * the name is taken, follow up with `suggestUsernames()`. Both calls funnel
 * through `handleOnboardingRecovery()` so a stale step, completed account, or
 * expired session on *either* call navigates instead of silently returning
 * suggestions or retrying. Extracted from `ChildrenStep` so the complete
 * two-call sequence is directly testable without a DOM.
 */
export async function checkUsernameAvailabilityAndSuggest(
  username: string,
  actions: {
    checkUsernameAvailability: (username: string) => Promise<OnboardingActionResult<{ available: boolean }>>;
    suggestUsernames: (
      username: string
    ) => Promise<OnboardingActionResult<{ available: boolean; suggestions: string[] }>>;
  },
  deps: { router: Pick<OnboardingNavigationRouter, "replace" | "refresh"> }
): Promise<UsernameAvailabilityResult> {
  const availability = await actions.checkUsernameAvailability(username);
  if (handleOnboardingRecovery(availability, deps.router)) {
    return availability;
  }

  if (availability.status !== "success") {
    return availability;
  }

  if (availability.data.available) {
    return { status: "available" };
  }

  const suggested = await actions.suggestUsernames(username);
  if (handleOnboardingRecovery(suggested, deps.router)) {
    return suggested;
  }

  if (suggested.status !== "success") {
    return suggested;
  }

  return { status: "taken", suggestions: suggested.data.suggestions };
}

/**
 * Orchestrates the CHILDREN -> COMPLETE transition: recovery/unauthenticated
 * results are handled the same as every other onboarding action, and a
 * success result refreshes the session by calling `update()` with no
 * arguments -- the server already advanced the database record, so the
 * client must never send its own onboarding claims -- before navigating to
 * the dashboard. Extracted from `ChildrenStep` so this contract is directly
 * testable without a DOM.
 */
export async function completeChildrenStep(
  finishChildrenStep: () => Promise<OnboardingActionResult>,
  deps: {
    router: OnboardingNavigationRouter;
    update: () => Promise<unknown>;
  }
): Promise<OnboardingActionResult> {
  const result = await finishChildrenStep();

  if (handleOnboardingRecovery(result, deps.router)) {
    return result;
  }

  if (result.status === "success") {
    await deps.update();
    deps.router.push("/dashboard");
  }

  return result;
}
