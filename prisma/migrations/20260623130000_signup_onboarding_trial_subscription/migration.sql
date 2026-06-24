-- AlterTable
ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

-- Migrate any existing rows off the removed STANDARD enum value before recreating the type
UPDATE "Subscription" SET "tier" = NULL WHERE "tier"::text = 'STANDARD';

-- AlterEnum (recreate SubscriptionTier without STANDARD, with FREE_TRIAL, MONTHLY, LIFETIME)
ALTER TYPE "SubscriptionTier" RENAME TO "SubscriptionTier_old";
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE_TRIAL', 'MONTHLY', 'LIFETIME', 'ADMIN', 'CANCELED');
ALTER TABLE "Subscription" ALTER COLUMN "tier" TYPE "SubscriptionTier" USING ("tier"::text::"SubscriptionTier");
DROP TYPE "SubscriptionTier_old";