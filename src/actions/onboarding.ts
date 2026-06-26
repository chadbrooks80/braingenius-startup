"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/db";
import { OnboardingStep } from "@/generated/prisma";
import { advanceOnboardingStep } from "@/lib/onboarding-funnel";

const MAX_CHILDREN = 2;
const USERNAME_REGEX = /^[a-z0-9]+$/;

async function getCurrentUserId() {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id;
}

export async function completeWelcomeVideoStep() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "You must be signed in to continue onboarding." };
  }

  try {
    await advanceOnboardingStep(userId, OnboardingStep.WELCOME_VIDEO);
    return { success: true };
  } catch (error) {
    console.error("completeWelcomeVideoStep failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

const ProfileSchema = z.object({
  fName: z.string().min(1, "First name is required"),
  lName: z.string().optional(),
});

type ProfileInput = z.infer<typeof ProfileSchema>;

export async function saveProfile(input: ProfileInput) {
  const parsed = ProfileSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "You must be signed in to continue onboarding." };
  }

  const { fName, lName } = parsed.data;
  const name = [fName, lName].filter(Boolean).join(" ");

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        fName,
        lName: lName || null,
        name,
      },
    });

    await advanceOnboardingStep(userId, OnboardingStep.PROFILE);

    return { success: true };
  } catch (error) {
    console.error("saveProfile failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export async function continueWithFreeTrial() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "You must be signed in to continue onboarding." };
  }

  try {
    await advanceOnboardingStep(userId, OnboardingStep.PLAN);
    return { success: true };
  } catch (error) {
    console.error("continueWithFreeTrial failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

const UsernameSchema = z.string().min(3).regex(USERNAME_REGEX);

export async function checkUsernameAvailability(username: string) {
  const parsed = UsernameSchema.safeParse(username);

  if (!parsed.success) {
    return { available: false };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { username: parsed.data } });
    return { available: !existing };
  } catch (error) {
    console.error("checkUsernameAvailability failed:", error);
    return { available: false };
  }
}

function normalizeUsernameBase(base: string) {
  return base.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function randomUsernameSuffix() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const SuggestUsernamesBaseSchema = z.string().min(1);
const SuggestUsernamesCountSchema = z.number().int().min(1).max(5);

export async function suggestUsernames(base: string, count = 3) {
  const baseParsed = SuggestUsernamesBaseSchema.safeParse(base);
  const countParsed = SuggestUsernamesCountSchema.safeParse(count);

  if (!baseParsed.success || !countParsed.success) {
    return { available: false, suggestions: [] as string[] };
  }

  const normalized = normalizeUsernameBase(baseParsed.data);

  if (!normalized) {
    return { available: false, suggestions: [] as string[] };
  }

  try {
    const suggestions: string[] = [];
    let attempts = 0;

    while (suggestions.length < countParsed.data && attempts < 20) {
      attempts += 1;
      const candidate = `${normalized}${randomUsernameSuffix()}`;
      if (suggestions.includes(candidate)) continue;

      const existing = await prisma.user.findUnique({ where: { username: candidate } });
      if (!existing) {
        suggestions.push(candidate);
      }
    }

    return { available: suggestions.length > 0, suggestions };
  } catch (error) {
    console.error("suggestUsernames failed:", error);
    return { available: false, suggestions: [] as string[] };
  }
}

const CreateChildSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  username: z
    .string()
    .min(3)
    .regex(USERNAME_REGEX, "Lowercase letters and numbers only"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  mustResetPassword: z.boolean(),
});

type CreateChildInput = z.infer<typeof CreateChildSchema>;

export async function createChildAccount(input: CreateChildInput) {
  const parsed = CreateChildSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "You must be signed in to continue onboarding." };
  }

  const { firstName, lastName, username, password, mustResetPassword } = parsed.data;

  try {
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return { success: false, error: "That User ID is already taken." };
    }

    const childCount = await prisma.parentStudent.count({ where: { parentId: userId } });
    if (childCount >= MAX_CHILDREN) {
      return { success: false, error: "You can only add up to 2 children." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const name = [firstName, lastName].filter(Boolean).join(" ");

    const child = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fName: firstName,
          lName: lastName || null,
          name,
          username,
          password: hashedPassword,
          role: "CHILD",
          mustResetPassword,
        },
      });

      await tx.parentStudent.create({
        data: {
          parentId: userId,
          studentId: created.id,
        },
      });

      return created;
    });

    return {
      success: true,
      data: { id: child.id, name: child.name ?? name, username: child.username ?? username },
    };
  } catch (error) {
    console.error("createChildAccount failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export async function finishChildrenStep() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "You must be signed in to finish onboarding." };
  }

  try {
    await advanceOnboardingStep(userId, OnboardingStep.CHILDREN);
    return { success: true };
  } catch (error) {
    console.error("finishChildrenStep failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
