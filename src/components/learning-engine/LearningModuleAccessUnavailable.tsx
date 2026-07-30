import Link from "next/link";
import { LearningWindowShell } from "@/components/learning-engine/LearningWindowShell";
import { LEARNING_ROUTE_ERROR_HOME_PATH } from "@/lib/learning-engine/errors/LearningRouteError";

/**
 * Minimal safe route-level presentation for an authenticated caller without
 * an allowed current Learning Module subscription tier. Deliberately
 * generic: it never reveals whether the problem is the caller, a parent,
 * Stripe status, price configuration, expiration, or a particular tier.
 * Rendered by the Server Component route wrapper before any client Learning
 * Engine initialization, so it is not a registered Learning Window and is
 * not driven by a `ScreenRequest`.
 */
export function LearningModuleAccessUnavailable() {
  return (
    <LearningWindowShell align="center">
      <h1 className="font-display text-2xl font-extrabold mb-3 text-heading">
        Lesson Unavailable
      </h1>
      <p className="text-sm mb-6 text-muted">
        This lesson isn&apos;t available for your account right now.
      </p>
      <Link
        href={LEARNING_ROUTE_ERROR_HOME_PATH}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 text-surface bg-heading shadow-[0_2px_8px] shadow-heading/(--alpha-soft) hover:-translate-y-0.5 hover:shadow-[0_6px_18px]"
      >
        Return Home
      </Link>
    </LearningWindowShell>
  );
}

export default LearningModuleAccessUnavailable;
