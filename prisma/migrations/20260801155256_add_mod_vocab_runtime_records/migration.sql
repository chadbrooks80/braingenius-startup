-- CreateEnum
CREATE TYPE "mod_vocab_runtime_record_kind" AS ENUM ('LESSON', 'CAPABILITY', 'ATTEMPT');

-- CreateTable
CREATE TABLE "mod_vocab_runtime_records" (
    "recordKind" "mod_vocab_runtime_record_kind" NOT NULL,
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "wordListId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mod_vocab_runtime_records_pkey" PRIMARY KEY ("recordKind","id")
);

-- CreateIndex
CREATE INDEX "mod_vocab_runtime_records_lessonId_recordKind_idx" ON "mod_vocab_runtime_records"("lessonId", "recordKind");

-- CreateIndex
CREATE INDEX "mod_vocab_runtime_records_learnerId_lessonId_idx" ON "mod_vocab_runtime_records"("learnerId", "lessonId");

-- CreateIndex
CREATE INDEX "mod_vocab_runtime_records_wordListId_idx" ON "mod_vocab_runtime_records"("wordListId");

-- CreateIndex
CREATE INDEX "mod_vocab_runtime_records_expiresAt_idx" ON "mod_vocab_runtime_records"("expiresAt");

-- AddForeignKey
ALTER TABLE "mod_vocab_runtime_records" ADD CONSTRAINT "mod_vocab_runtime_records_wordListId_fkey" FOREIGN KEY ("wordListId") REFERENCES "mod_vocab_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
