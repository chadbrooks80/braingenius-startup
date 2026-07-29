-- CreateEnum
CREATE TYPE "TtsUsageScope" AS ENUM ('CALLER_MINUTE', 'CALLER_DAY', 'ENTITLEMENT_DAY');

-- CreateEnum
CREATE TYPE "TtsRequestKind" AS ENUM ('PUBLIC_TEXT', 'VOCABULARY_PROTECTED');

-- CreateEnum
CREATE TYPE "TtsProvider" AS ENUM ('GOOGLE', 'LEMONFOX');

-- CreateEnum
CREATE TYPE "TtsUsageAlertKind" AS ENUM ('FIVE_HOUR_WARNING', 'TEN_HOUR_CUTOFF');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ttsSuspendedAt" TIMESTAMP(3),
ADD COLUMN     "ttsSuspensionReasonCode" TEXT;

-- CreateTable
CREATE TABLE "TtsUsageBucket" (
    "id" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "scope" "TtsUsageScope" NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "provider" "TtsProvider" NOT NULL,
    "requestKind" "TtsRequestKind" NOT NULL,
    "acceptedRequests" INTEGER NOT NULL DEFAULT 0,
    "acceptedInputBytes" INTEGER NOT NULL DEFAULT 0,
    "acceptedInputCharacters" INTEGER NOT NULL DEFAULT 0,
    "acceptedWords" INTEGER NOT NULL DEFAULT 0,
    "successfulRequests" INTEGER NOT NULL DEFAULT 0,
    "failedRequests" INTEGER NOT NULL DEFAULT 0,
    "rejectedBurst" INTEGER NOT NULL DEFAULT 0,
    "rejectedConcurrency" INTEGER NOT NULL DEFAULT 0,
    "rejectedExtremeUsage" INTEGER NOT NULL DEFAULT 0,
    "generatedAudioBytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TtsUsageBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TtsUsageAlert" (
    "id" TEXT NOT NULL,
    "callerUserId" TEXT NOT NULL,
    "entitlementPrincipalUserId" TEXT NOT NULL,
    "dayStart" TIMESTAMP(3) NOT NULL,
    "kind" "TtsUsageAlertKind" NOT NULL,
    "observedWords" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TtsUsageAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TtsRequestLease" (
    "id" TEXT NOT NULL,
    "callerUserId" TEXT NOT NULL,
    "entitlementPrincipalUserId" TEXT NOT NULL,
    "provider" "TtsProvider" NOT NULL,
    "requestKind" "TtsRequestKind" NOT NULL,
    "inputBytes" INTEGER NOT NULL,
    "inputCharacters" INTEGER NOT NULL,
    "inputWords" INTEGER NOT NULL,
    "callerMinuteStart" TIMESTAMP(3) NOT NULL,
    "callerDayStart" TIMESTAMP(3) NOT NULL,
    "principalDayStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TtsRequestLease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TtsUsageBucket_subjectUserId_scope_windowStart_idx" ON "TtsUsageBucket"("subjectUserId", "scope", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "TtsUsageBucket_subjectUserId_scope_windowStart_provider_req_key" ON "TtsUsageBucket"("subjectUserId", "scope", "windowStart", "provider", "requestKind");

-- CreateIndex
CREATE INDEX "TtsUsageAlert_entitlementPrincipalUserId_dayStart_idx" ON "TtsUsageAlert"("entitlementPrincipalUserId", "dayStart");

-- CreateIndex
CREATE UNIQUE INDEX "TtsUsageAlert_callerUserId_dayStart_kind_key" ON "TtsUsageAlert"("callerUserId", "dayStart", "kind");

-- CreateIndex
CREATE INDEX "TtsRequestLease_callerUserId_expiresAt_idx" ON "TtsRequestLease"("callerUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "TtsRequestLease_entitlementPrincipalUserId_expiresAt_idx" ON "TtsRequestLease"("entitlementPrincipalUserId", "expiresAt");

-- AddForeignKey
ALTER TABLE "TtsUsageBucket" ADD CONSTRAINT "TtsUsageBucket_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TtsUsageAlert" ADD CONSTRAINT "TtsUsageAlert_callerUserId_fkey" FOREIGN KEY ("callerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TtsUsageAlert" ADD CONSTRAINT "TtsUsageAlert_entitlementPrincipalUserId_fkey" FOREIGN KEY ("entitlementPrincipalUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TtsRequestLease" ADD CONSTRAINT "TtsRequestLease_callerUserId_fkey" FOREIGN KEY ("callerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TtsRequestLease" ADD CONSTRAINT "TtsRequestLease_entitlementPrincipalUserId_fkey" FOREIGN KEY ("entitlementPrincipalUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
