import "server-only";
import prisma from "@/lib/db";

// Narrow server-only manual TTS suspension boundary for authorized operators
// after confirmed abuse review. Suspension never changes subscription
// entitlement and is never applied automatically: crossing the five-hour
// warning or ten-hour daily cutoff must not write these fields. Suspending a
// caller pauses only that caller; suspending an entitlement principal is the
// deliberate way to pause TTS for the whole entitled family. There is no
// browser or learner endpoint for this module.

// Machine-readable operator codes only; reasons stay server-only and must
// never carry free text, personal data, or provider details.
const SUSPENSION_REASON_CODE_PATTERN = /^[a-z0-9_-]{1,64}$/i;

export type TtsSuspensionDb = {
  setTtsSuspension(
    userId: string,
    state: { ttsSuspendedAt: Date | null; ttsSuspensionReasonCode: string | null }
  ): Promise<{ count: number }>;
};

const prismaSuspensionDb: TtsSuspensionDb = {
  setTtsSuspension(userId, state) {
    return prisma.user.updateMany({ where: { id: userId }, data: state });
  },
};

export type TtsSuspensionDeps = {
  db?: TtsSuspensionDb;
  now?: Date;
};

/**
 * Suspends paid TTS for one user (caller or entitlement principal) after
 * authorized review. Fails visibly when the user does not exist.
 */
export async function suspendTtsAccess(
  input: { userId: string; reasonCode: string },
  deps: TtsSuspensionDeps = {}
): Promise<void> {
  if (!SUSPENSION_REASON_CODE_PATTERN.test(input.reasonCode)) {
    throw new Error("TTS suspension reason code must be a short machine-readable code.");
  }
  const db = deps.db ?? prismaSuspensionDb;
  const result = await db.setTtsSuspension(input.userId, {
    ttsSuspendedAt: deps.now ?? new Date(),
    ttsSuspensionReasonCode: input.reasonCode,
  });
  if (result.count !== 1) {
    throw new Error("TTS suspension target user was not found.");
  }
}

/** Lifts a manual TTS suspension; normal Stage 1 entitlement applies again. */
export async function liftTtsSuspension(
  input: { userId: string },
  deps: TtsSuspensionDeps = {}
): Promise<void> {
  const db = deps.db ?? prismaSuspensionDb;
  const result = await db.setTtsSuspension(input.userId, {
    ttsSuspendedAt: null,
    ttsSuspensionReasonCode: null,
  });
  if (result.count !== 1) {
    throw new Error("TTS suspension target user was not found.");
  }
}
