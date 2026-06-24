"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { getTrialDates } from "@/lib/subscription";

const RegisterSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function registerUser(formData: FormData) {
  const parsed = RegisterSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message,
    };
  }

  const { email, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "An account with this email already exists." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { trialStartedAt, trialEndsAt } = getTrialDates();

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: "PARENT",
        subscription: {
          create: {
            tier: "FREE_TRIAL",
            trialStartedAt,
            trialEndsAt,
          },
        },
      },
    });

    return { success: true };
  } catch (error) {
    console.error("registerUser failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
