import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { hashValue } from "@/lib/auth-tokens";
import { CanonicalEmailSchema } from "@/lib/auth/email-normalization";

const ConfirmSchema = z.object({
  email: CanonicalEmailSchema,
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ConfirmSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error?.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { email, token, password } = parsed.data;

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashValue(token) },
    include: { user: true },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt < new Date() ||
    resetToken.user.email !== email
  ) {
    return NextResponse.json(
      { success: false, error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    // A valid email-token reset proves possession of the reset link, which is
    // sufficient to also clear a pending required-reset flag -- otherwise a
    // mustResetPassword child who recovers through this ordinary flow would
    // stay permanently routed to /required-password-reset.
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword, mustResetPassword: false },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
