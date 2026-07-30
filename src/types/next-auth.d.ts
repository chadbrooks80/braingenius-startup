import type { DefaultSession } from "next-auth";
import type { OnboardingStep, UserRole } from "@/generated/prisma";
import type { LearningSubscriptionTier } from "@/types/learning";

// Truthful augmentation of the runtime session/JWT contract established in
// `src/auth.ts`. Session fields are non-optional because the `session()`
// callback always assigns them whenever `session.user` exists. JWT fields
// stay optional because the `jwt()` callback only establishes them once a
// signed-in `user` (or a subsequent `update` trigger) has run.
//
// `mustResetPassword` is an early-routing hint only: it lets the proxy and
// client redirect quickly, but every protected boundary re-reads the
// database flag before treating a reset-required account as cleared.
//
// `subscriptionTier` is likewise a session-context hint only: it is the
// caller's server-derived current effective tier (or `null`) at the last
// sign-in or `session.update()` refresh, never the final Learning Module
// authorization boundary. `src/lib/auth/module-access.ts` always re-resolves
// current database entitlement before granting module access.
declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id: string;
      role: UserRole | null;
      onboardingCompleted: boolean;
      onboardingStep: OnboardingStep;
      mustResetPassword: boolean;
      subscriptionTier: LearningSubscriptionTier | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole | null;
    onboardingCompleted?: boolean;
    onboardingStep?: OnboardingStep;
    mustResetPassword?: boolean;
    subscriptionTier?: LearningSubscriptionTier | null;
  }
}
