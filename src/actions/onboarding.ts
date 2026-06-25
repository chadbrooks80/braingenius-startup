"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/db";
import { OnboardingStep } from "@/generated/prisma";
import { advanceOnboardingStep } from "@/lib/onboarding-funnel";

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

const ChildrenSchema = z.object({
  child1Name: z.string().min(1, "Child 1 first name is required"),
  child2Name: z.string().optional(),
});

type ChildrenInput = z.infer<typeof ChildrenSchema>;

export async function completeOnboarding(input: ChildrenInput) {
  const parsed = ChildrenSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "You must be signed in to finish onboarding." };
  }

  const { child1Name, child2Name } = parsed.data;
  const childNames = [child1Name, child2Name].filter((n): n is string => Boolean(n));

  try {
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (existingUser?.onboardingCompleted) {
      return { success: true };
    }

    await prisma.$transaction(async (tx) => {
      for (const childName of childNames) {
        const child = await tx.user.create({
          data: {
            fName: childName,
            name: childName,
            role: "CHILD",
          },
        });

        await tx.parentStudent.create({
          data: {
            parentId: userId,
            studentId: child.id,
          },
        });
      }
    });

    await advanceOnboardingStep(userId, OnboardingStep.CHILDREN);

    return { success: true };
  } catch (error) {
    console.error("completeOnboarding failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
