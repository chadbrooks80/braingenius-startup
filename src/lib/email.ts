import { Resend } from "resend";
import { VERIFICATION_CODE_EXPIRY_MINUTES } from "@/lib/auth-tokens";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }

  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }

  return resend;
}

export async function sendVerificationCodeEmail(email: string, code: string): Promise<void> {
  await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "Your BrainGenius Verification Code",
    text: `Your verification code is\n\n${code}\n\nThis code expires in ${VERIFICATION_CODE_EXPIRY_MINUTES} minutes.`,
  });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "Reset Your BrainGenius Password",
    html: `<p>We received a request to reset your BrainGenius password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  });
}
