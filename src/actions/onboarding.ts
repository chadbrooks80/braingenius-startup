"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma, { lockUserRow } from "@/lib/db";
import { OnboardingStep, Prisma, UserRole } from "@/generated/prisma";
import {
  advanceParentOnboardingStep,
  getOnboardingRoute,
  onboardingError,
  onboardingSuccess,
  ONBOARDING_UNAUTHENTICATED,
  requireParentAtStep,
  type OnboardingActionResult,
} from "@/lib/onboarding-funnel";

const MAX_CHILDREN = 2;
const USERNAME_REGEX = /^[a-z0-9]+$/;
const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

async function getCurrentUserId(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id;
}

export async function completeWelcomeVideoStep(): Promise<OnboardingActionResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return ONBOARDING_UNAUTHENTICATED;
  }

  try {
    return await advanceParentOnboardingStep(userId, OnboardingStep.WELCOME_VIDEO);
  } catch (error) {
    console.error("completeWelcomeVideoStep failed:", error);
    return onboardingError("Something went wrong. Please try again.");
  }
}

const ProfileSchema = z.object({
  fName: z.string().min(1, "First name is required"),
  lName: z.string().optional(),
});

type ProfileInput = z.infer<typeof ProfileSchema>;

export async function saveProfile(input: ProfileInput): Promise<OnboardingActionResult> {
  const parsed = ProfileSchema.safeParse(input);

  if (!parsed.success) {
    return onboardingError(parsed.error.issues[0].message);
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return ONBOARDING_UNAUTHENTICATED;
  }

  const { fName, lName } = parsed.data;
  const name = [fName, lName].filter(Boolean).join(" ");

  try {
    // Profile fields and the PROFILE -> PLAN transition are written by the
    // same conditional `updateMany` call, so they succeed or fail together.
    return await advanceParentOnboardingStep(userId, OnboardingStep.PROFILE, {
      fName,
      lName: lName || null,
      name,
    });
  } catch (error) {
    console.error("saveProfile failed:", error);
    return onboardingError("Something went wrong. Please try again.");
  }
}

export async function continueWithFreeTrial(): Promise<OnboardingActionResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return ONBOARDING_UNAUTHENTICATED;
  }

  try {
    return await advanceParentOnboardingStep(userId, OnboardingStep.PLAN);
  } catch (error) {
    console.error("continueWithFreeTrial failed:", error);
    return onboardingError("Something went wrong. Please try again.");
  }
}

const UsernameSchema = z.string().min(3).regex(USERNAME_REGEX);

export async function checkUsernameAvailability(
  username: string
): Promise<OnboardingActionResult<{ available: boolean }>> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return ONBOARDING_UNAUTHENTICATED;
  }

  const authorization = await requireParentAtStep(userId, OnboardingStep.CHILDREN);
  if (!("authorized" in authorization)) {
    return authorization;
  }

  const parsed = UsernameSchema.safeParse(username);

  if (!parsed.success) {
    return onboardingSuccess({ available: false });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { username: parsed.data } });
    return onboardingSuccess({ available: !existing });
  } catch (error) {
    console.error("checkUsernameAvailability failed:", error);
    return onboardingError("Something went wrong. Please try again.");
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

export async function suggestUsernames(
  base: string,
  count = 3
): Promise<OnboardingActionResult<{ available: boolean; suggestions: string[] }>> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return ONBOARDING_UNAUTHENTICATED;
  }

  const authorization = await requireParentAtStep(userId, OnboardingStep.CHILDREN);
  if (!("authorized" in authorization)) {
    return authorization;
  }

  const baseParsed = SuggestUsernamesBaseSchema.safeParse(base);
  const countParsed = SuggestUsernamesCountSchema.safeParse(count);

  if (!baseParsed.success || !countParsed.success) {
    return onboardingSuccess({ available: false, suggestions: [] });
  }

  const normalized = normalizeUsernameBase(baseParsed.data);

  if (!normalized) {
    return onboardingSuccess({ available: false, suggestions: [] });
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

    return onboardingSuccess({ available: suggestions.length > 0, suggestions });
  } catch (error) {
    console.error("suggestUsernames failed:", error);
    return onboardingError("Something went wrong. Please try again.");
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
type ChildSummary = { id: string; name: string; username: string };

export async function createChildAccount(
  input: CreateChildInput
): Promise<OnboardingActionResult<ChildSummary>> {
  const parsed = CreateChildSchema.safeParse(input);

  if (!parsed.success) {
    return onboardingError(parsed.error.issues[0].message);
  }

  const userId = await getCurrentUserId();

  if (!userId) {
    return ONBOARDING_UNAUTHENTICATED;
  }

  const { firstName, lastName, username, password, mustResetPassword } = parsed.data;
  // Hash before opening the transaction so the row lock below is held only
  // for the cheap validation + insert, not for bcrypt's CPU-bound work.
  const hashedPassword = await bcrypt.hash(password, 10);
  const name = [firstName, lastName].filter(Boolean).join(" ");

  try {
    return await prisma.$transaction(async (tx) => {
      // Locks this parent's row for the rest of the transaction, so a second
      // concurrent request for the same parent cannot read the child count
      // until this one has committed or rolled back.
      await lockUserRow(tx, userId);

      const parent = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true, onboardingStep: true, onboardingCompleted: true },
      });

      if (!parent) {
        return ONBOARDING_UNAUTHENTICATED;
      }

      if (
        parent.role !== UserRole.PARENT ||
        parent.onboardingStep !== OnboardingStep.CHILDREN ||
        parent.onboardingCompleted
      ) {
        return { status: "recovery" as const, redirectTo: getOnboardingRoute(parent) };
      }

      const childCount = await tx.parentStudent.count({ where: { parentId: userId } });
      if (childCount >= MAX_CHILDREN) {
        return onboardingError("You can only add up to 2 children.");
      }

      try {
        const created = await tx.user.create({
          data: {
            fName: firstName,
            lName: lastName || null,
            name,
            username,
            password: hashedPassword,
            role: UserRole.CHILD,
            mustResetPassword,
          },
        });

        await tx.parentStudent.create({
          data: {
            parentId: userId,
            studentId: created.id,
          },
        });

        return onboardingSuccess({
          id: created.id,
          name: created.name ?? name,
          username: created.username ?? username,
        });
      } catch (error) {
        const isUsernameConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === UNIQUE_CONSTRAINT_VIOLATION;
        if (isUsernameConflict) {
          return onboardingError("That User ID is already taken.");
        }
        throw error;
      }
    });
  } catch (error) {
    console.error("createChildAccount failed:", error);
    return onboardingError("Something went wrong. Please try again.");
  }
}

export async function finishChildrenStep(): Promise<OnboardingActionResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return ONBOARDING_UNAUTHENTICATED;
  }

  try {
    return await advanceParentOnboardingStep(userId, OnboardingStep.CHILDREN);
  } catch (error) {
    console.error("finishChildrenStep failed:", error);
    return onboardingError("Something went wrong. Please try again.");
  }
}
