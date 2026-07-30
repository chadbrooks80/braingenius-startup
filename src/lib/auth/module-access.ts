import "server-only";
import { loadLearningModuleSettings } from "@/lib/learning-engine/initialization/loadLearningModule";
import { validateModuleSettings } from "@/lib/learning-engine/initialization/validateModuleSettings";
import { LearningRouteError } from "@/lib/learning-engine/errors/LearningRouteError";
import {
  resolveEffectiveSubscriptionTier,
  type ResolveEffectiveSubscriptionTierDeps,
} from "@/lib/billing/effective-subscription-tier";
import type { LearningSubscriptionTier, ModuleSettings } from "@/types/learning";

// Subject-neutral, server-only Learning Module access boundary shared by the
// learning route and every direct Vocabulary HTTP boundary. Ownership stays
// with the host: it re-reads current database entitlement truth on every
// call instead of trusting the JWT/session tier hint, and it never
// interprets Vocabulary-specific (or any other module's) content.

export type LearningModuleAccessResult =
  // The requested module name has no registered settings loader (or its
  // settings fail structural validation). This is not an access decision --
  // callers must defer to the module's own existing "not found" error
  // ownership instead of presenting a misleading access-denied state.
  | { status: "unregistered" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "granted"; tier: LearningSubscriptionTier };

export type AuthorizeLearningModuleAccessDeps = {
  getSessionUserId?: () => Promise<string | null>;
  loadSettings?: (moduleName: string) => Promise<ModuleSettings>;
  resolveEffectiveTier?: (
    userId: string,
    deps?: ResolveEffectiveSubscriptionTierDeps
  ) => Promise<LearningSubscriptionTier | null>;
};

// Loaded lazily so this module can be imported without initializing the full
// NextAuth stack; only a real request path resolves the session this way.
async function defaultGetSessionUserId(): Promise<string | null> {
  const [{ getServerSession }, { authOptions }] = await Promise.all([
    import("next-auth"),
    import("@/auth"),
  ]);
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  return typeof userId === "string" && userId !== "" ? userId : null;
}

/**
 * Authorizes the current authenticated caller against one registered
 * Learning Module's required `subscriptionTier` settings. Settings are
 * loaded and validated first so an unknown/malformed module never presents
 * as an authenticated-but-forbidden account; only once the module is known
 * does the caller's identity and current effective subscription tier get
 * resolved. Every branch fails closed: an unexpected failure at any stage
 * denies access rather than granting it.
 */
export async function authorizeLearningModuleAccess(
  moduleName: string,
  deps: AuthorizeLearningModuleAccessDeps = {}
): Promise<LearningModuleAccessResult> {
  let settings: ModuleSettings;
  try {
    settings = await (deps.loadSettings ?? loadLearningModuleSettings)(moduleName);
    validateModuleSettings(settings);
  } catch (error) {
    if (error instanceof LearningRouteError && error.kind === "MODULE_NOT_FOUND") {
      return { status: "unregistered" };
    }
    console.error("[learning-module-access] settings unavailable", error);
    return { status: "unavailable" };
  }

  let callerUserId: string | null;
  try {
    callerUserId = await (deps.getSessionUserId ?? defaultGetSessionUserId)();
  } catch (error) {
    console.error("[learning-module-access] session lookup unavailable", error);
    return { status: "unavailable" };
  }
  if (!callerUserId) {
    return { status: "unauthenticated" };
  }

  let tier: LearningSubscriptionTier | null;
  try {
    tier = await (deps.resolveEffectiveTier ?? resolveEffectiveSubscriptionTier)(
      callerUserId
    );
  } catch (error) {
    console.error("[learning-module-access] tier resolution unavailable", error);
    return { status: "unavailable" };
  }

  if (!tier || !settings.subscriptionTier.includes(tier)) {
    return { status: "forbidden" };
  }

  return { status: "granted", tier };
}

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function jsonNoStore(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE_HEADERS });
}

/**
 * Translates a non-granted access result into the learner-safe HTTP
 * contract shared by every direct Vocabulary HTTP boundary. Bodies stay
 * generic: they never reveal the current tier, parent identity, Stripe
 * state, price mismatch, entitlement source, or denial internals.
 */
export function learningModuleAccessDenialResponse(
  result: Exclude<LearningModuleAccessResult, { status: "granted" }>
): Response {
  switch (result.status) {
    case "unauthenticated":
      return jsonNoStore(401, "Sign in to use this learning module.");
    case "forbidden":
      return jsonNoStore(403, "This learning module is not available for this account.");
    case "unregistered":
    case "unavailable":
      return jsonNoStore(503, "This learning module is temporarily unavailable.");
  }
}
