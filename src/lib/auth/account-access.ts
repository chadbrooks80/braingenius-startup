import "server-only";
import { OnboardingStep, UserRole } from "@/generated/prisma";
import { getOnboardingRoute } from "@/lib/onboarding-funnel";
import prisma from "@/lib/db";

export const REQUIRED_PASSWORD_RESET_ROUTE = "/required-password-reset";
export const MISSING_ACCOUNT_ROUTE = "/sign-in";

export type AccountAccessState = {
  role: UserRole | null;
  mustResetPassword: boolean;
  onboardingCompleted: boolean;
  onboardingStep: OnboardingStep;
};

/**
 * The single account-destination decision every protected boundary consults:
 * a pending required password reset always wins over onboarding routing, so
 * a reset-required account can never reach the dashboard, getting-started,
 * or authenticated learning through any caller of this function. Callers
 * that only have a JWT-derived hint (the proxy) may call this for fast UX
 * redirects, but must not treat the result as final authorization -- only a
 * caller that re-read `mustResetPassword` from the database in this request
 * may rely on it to actually gate access.
 */
export function getAccountAccessRoute(user: AccountAccessState): string {
  if (user.mustResetPassword) {
    return REQUIRED_PASSWORD_RESET_ROUTE;
  }

  return getOnboardingRoute(user);
}

export type SessionAccountAccess =
  | { status: "missing-account" }
  | { status: "ok"; destination: string };

const ACCOUNT_ACCESS_SELECT = {
  role: true,
  mustResetPassword: true,
  onboardingCompleted: true,
  onboardingStep: true,
} as const;

/**
 * The single database-authoritative "does this session's account still
 * exist, and where does it belong" check shared by every protected
 * boundary this phase touches (the (app) layout and the auth-only
 * playground routes). A session whose user id no longer matches a
 * database row -- a deleted or never-existed account riding a stale JWT --
 * always resolves to `missing-account` here so a caller can fail closed
 * before rendering protected content, instead of only checking
 * `mustResetPassword` and silently treating "no user" as "not reset
 * required".
 */
export async function resolveSessionAccountAccess(userId: string): Promise<SessionAccountAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: ACCOUNT_ACCESS_SELECT,
  });

  if (!user) {
    return { status: "missing-account" };
  }

  return { status: "ok", destination: getAccountAccessRoute(user) };
}
