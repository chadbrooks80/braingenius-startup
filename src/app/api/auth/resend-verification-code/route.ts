import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import {
  generateVerificationCode,
  hashValue,
  minutesFromNow,
  RESEND_COOLDOWN_SECONDS,
  VERIFICATION_CODE_EXPIRY_MINUTES,
} from "@/lib/auth-tokens";
import { sendVerificationCodeEmail } from "@/lib/email";

const ResendSchema = z.object({
  email: z.email(),
});

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ResendSchema.safeParse(body);

  if (parsed.success) {
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && !user.emailVerified) {
      const lastCode = await prisma.emailVerificationCode.findFirst({
        where: { email },
        orderBy: { createdAt: "desc" },
      });

      const isCoolingDown =
        lastCode && Date.now() - lastCode.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000;

      // The cooldown is enforced by silently skipping code creation and
      // delivery -- never by a distinct status, body, or client copy -- so
      // it can't be used to infer whether an account exists or is verified.
      if (!isCoolingDown) {
        await prisma.emailVerificationCode.updateMany({
          where: { email, usedAt: null },
          data: { usedAt: new Date() },
        });

        const code = generateVerificationCode();

        await prisma.emailVerificationCode.create({
          data: {
            email,
            codeHash: hashValue(code),
            expiresAt: minutesFromNow(VERIFICATION_CODE_EXPIRY_MINUTES),
          },
        });

        try {
          await sendVerificationCodeEmail(email, code);
        } catch (error) {
          console.error("sendVerificationCodeEmail failed:", error);
        }
      }
    }
  }

  // Always return the same generic response -- malformed input, unknown
  // email, already-verified account, cooldown, and eligible-unverified
  // account all look identical to the caller.
  return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}
