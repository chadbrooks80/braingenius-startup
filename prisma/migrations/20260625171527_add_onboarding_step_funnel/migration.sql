-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('VERIFY_EMAIL', 'WELCOME_VIDEO', 'PROFILE', 'PLAN', 'CHILDREN', 'COMPLETE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingStep" "OnboardingStep" NOT NULL DEFAULT 'VERIFY_EMAIL';

-- Backfill existing users into the correct funnel step so the new column
-- reflects where each account actually is, instead of restarting everyone
-- at VERIFY_EMAIL.
UPDATE "User" SET "onboardingStep" = 'COMPLETE' WHERE "onboardingCompleted" = true;
UPDATE "User" SET "onboardingStep" = 'PROFILE' WHERE "onboardingCompleted" = false AND "emailVerified" IS NOT NULL;
