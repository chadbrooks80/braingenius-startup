import crypto from "crypto";

export const VERIFICATION_CODE_EXPIRY_MINUTES = 10;
export const VERIFICATION_CODE_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_EXPIRY_HOURS = 1;
export const RESEND_COOLDOWN_SECONDS = 60;

export function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateVerificationCode(): string {
  return crypto.randomInt(1000, 10000).toString();
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
