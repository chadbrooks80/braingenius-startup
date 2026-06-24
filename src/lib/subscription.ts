export const TRIAL_DURATION_DAYS = 3;

export function getTrialDates(from: Date = new Date()) {
  const trialStartedAt = from;
  const trialEndsAt = new Date(
    trialStartedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
  );
  return { trialStartedAt, trialEndsAt };
}
