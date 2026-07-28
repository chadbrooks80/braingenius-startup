import type { DefaultSession } from "next-auth";
import type { OnboardingStep } from "@/generated/prisma";

// Truthful augmentation of the runtime session/JWT contract established in
// `src/auth.ts`. Session fields are non-optional because the `session()`
// callback always assigns them whenever `session.user` exists. JWT fields
// stay optional because the `jwt()` callback only establishes them once a
// signed-in `user` (or a subsequent `update` trigger) has run.
declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id: string;
      onboardingCompleted: boolean;
      onboardingStep: OnboardingStep;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    onboardingCompleted?: boolean;
    onboardingStep?: OnboardingStep;
  }
}
