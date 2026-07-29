import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { hashValue } from "@/lib/auth-tokens";
import { CanonicalEmailSchema } from "@/lib/auth/email-normalization";
import { confirmPasswordReset } from "@/lib/auth/password-reset";

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
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await confirmPasswordReset({
    rawEmail: email,
    tokenHash: hashValue(token),
    hashedPassword,
    now: new Date(),
  });

  if (result.status === "invalid") {
    return NextResponse.json(
      { success: false, error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
