-- CreateEnum
CREATE TYPE "mod_vocab_content_source" AS ENUM ('WORD_ONLY', 'DICTIONARY', 'TEACHER', 'MIXED');

-- CreateEnum
CREATE TYPE "mod_vocab_learning_status" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "mod_vocab_review_stage" AS ENUM ('IDLE', 'DEFINITION_PENDING', 'SPELLING_PENDING');

-- CreateEnum
CREATE TYPE "mod_vocab_session_status" AS ENUM ('ACTIVE', 'ENDED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "mod_vocab_attempt_type" AS ENUM ('DEFINITION', 'SPELLING');

-- CreateEnum
CREATE TYPE "mod_vocab_attempt_status" AS ENUM ('ACTIVE', 'ANSWERED', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "mod_vocab_lists" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mod_vocab_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_vocab_list_words" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "dictionaryEntryId" TEXT,
    "position" INTEGER NOT NULL,
    "word" TEXT NOT NULL,
    "normalizedWord" TEXT NOT NULL,
    "definition" TEXT,
    "spellingDefinition" TEXT,
    "exampleSentence1" TEXT,
    "exampleSentence2" TEXT,
    "exampleSentence3" TEXT,
    "interestingFact" TEXT,
    "contentSource" "mod_vocab_content_source" NOT NULL DEFAULT 'WORD_ONLY',
    "contentResolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mod_vocab_list_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_vocab_learnings" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "learnerUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "status" "mod_vocab_learning_status" NOT NULL DEFAULT 'ACTIVE',
    "dailyGoalSeconds" INTEGER NOT NULL DEFAULT 1800,
    "gradedAnswerCount" INTEGER NOT NULL DEFAULT 0,
    "correctAnswerCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectAnswerCount" INTEGER NOT NULL DEFAULT 0,
    "servedCheckpointGroupCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mod_vocab_learnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_vocab_word_progress" (
    "id" TEXT NOT NULL,
    "learningId" TEXT NOT NULL,
    "listWordId" TEXT NOT NULL,
    "introduced" BOOLEAN NOT NULL DEFAULT false,
    "introducedAt" TIMESTAMP(3),
    "definitionConsecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "definitionMastered" BOOLEAN NOT NULL DEFAULT false,
    "definitionMasteredAt" TIMESTAMP(3),
    "spellingConsecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "spellingMastered" BOOLEAN NOT NULL DEFAULT false,
    "spellingMasteredAt" TIMESTAMP(3),
    "practicePresentationCount" INTEGER NOT NULL DEFAULT 0,
    "reviewStage" "mod_vocab_review_stage" NOT NULL DEFAULT 'IDLE',
    "nextReviewQuestionNumber" INTEGER,
    "totalCorrect" INTEGER NOT NULL DEFAULT 0,
    "totalIncorrect" INTEGER NOT NULL DEFAULT 0,
    "initialMasterySequence" INTEGER,
    "firstMasteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mod_vocab_word_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_vocab_sessions" (
    "id" TEXT NOT NULL,
    "learningId" TEXT NOT NULL,
    "status" "mod_vocab_session_status" NOT NULL DEFAULT 'ACTIVE',
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "gradedAnswerCount" INTEGER NOT NULL DEFAULT 0,
    "correctAnswerCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectAnswerCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mod_vocab_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_vocab_attempts" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "listWordId" TEXT NOT NULL,
    "answerType" "mod_vocab_attempt_type" NOT NULL,
    "status" "mod_vocab_attempt_status" NOT NULL DEFAULT 'ACTIVE',
    "review" BOOLEAN NOT NULL DEFAULT false,
    "correctAnswerSnapshot" TEXT,
    "submittedAnswer" TEXT,
    "wasCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mod_vocab_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_vocab_attempt_choices" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "sourceListWordId" TEXT,
    "position" INTEGER NOT NULL,
    "textSnapshot" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mod_vocab_attempt_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_vocab_daily_practice" (
    "id" TEXT NOT NULL,
    "learnerUserId" TEXT NOT NULL,
    "practiceDate" DATE NOT NULL,
    "goalSeconds" INTEGER NOT NULL DEFAULT 1800,
    "secondsStudied" INTEGER NOT NULL DEFAULT 0,
    "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "goalReachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mod_vocab_daily_practice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mod_vocab_lists_ownerUserId_createdAt_idx" ON "mod_vocab_lists"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "mod_vocab_list_words_dictionaryEntryId_idx" ON "mod_vocab_list_words"("dictionaryEntryId");

-- CreateIndex
CREATE INDEX "mod_vocab_list_words_listId_position_idx" ON "mod_vocab_list_words"("listId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "mod_vocab_list_words_listId_position_key" ON "mod_vocab_list_words"("listId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "mod_vocab_list_words_listId_normalizedWord_key" ON "mod_vocab_list_words"("listId", "normalizedWord");

-- CreateIndex
CREATE INDEX "mod_vocab_learnings_learnerUserId_status_idx" ON "mod_vocab_learnings"("learnerUserId", "status");

-- CreateIndex
CREATE INDEX "mod_vocab_learnings_listId_idx" ON "mod_vocab_learnings"("listId");

-- CreateIndex
CREATE INDEX "mod_vocab_learnings_assignedByUserId_idx" ON "mod_vocab_learnings"("assignedByUserId");

-- CreateIndex
CREATE INDEX "mod_vocab_word_progress_learningId_spellingMastered_idx" ON "mod_vocab_word_progress"("learningId", "spellingMastered");

-- CreateIndex
CREATE INDEX "mod_vocab_word_progress_learningId_reviewStage_nextReviewQu_idx" ON "mod_vocab_word_progress"("learningId", "reviewStage", "nextReviewQuestionNumber");

-- CreateIndex
CREATE INDEX "mod_vocab_word_progress_listWordId_idx" ON "mod_vocab_word_progress"("listWordId");

-- CreateIndex
CREATE UNIQUE INDEX "mod_vocab_word_progress_learningId_listWordId_key" ON "mod_vocab_word_progress"("learningId", "listWordId");

-- CreateIndex
CREATE UNIQUE INDEX "mod_vocab_word_progress_learningId_initialMasterySequence_key" ON "mod_vocab_word_progress"("learningId", "initialMasterySequence");

-- CreateIndex
CREATE INDEX "mod_vocab_sessions_learningId_startedAt_idx" ON "mod_vocab_sessions"("learningId", "startedAt");

-- CreateIndex
CREATE INDEX "mod_vocab_sessions_learningId_status_idx" ON "mod_vocab_sessions"("learningId", "status");

-- CreateIndex
CREATE INDEX "mod_vocab_attempts_sessionId_status_idx" ON "mod_vocab_attempts"("sessionId", "status");

-- CreateIndex
CREATE INDEX "mod_vocab_attempts_listWordId_createdAt_idx" ON "mod_vocab_attempts"("listWordId", "createdAt");

-- CreateIndex
CREATE INDEX "mod_vocab_attempt_choices_sourceListWordId_idx" ON "mod_vocab_attempt_choices"("sourceListWordId");

-- CreateIndex
CREATE UNIQUE INDEX "mod_vocab_attempt_choices_attemptId_position_key" ON "mod_vocab_attempt_choices"("attemptId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "mod_vocab_attempt_choices_attemptId_sourceListWordId_key" ON "mod_vocab_attempt_choices"("attemptId", "sourceListWordId");

-- CreateIndex
CREATE INDEX "mod_vocab_daily_practice_learnerUserId_practiceDate_idx" ON "mod_vocab_daily_practice"("learnerUserId", "practiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "mod_vocab_daily_practice_learnerUserId_practiceDate_key" ON "mod_vocab_daily_practice"("learnerUserId", "practiceDate");

-- AddForeignKey
ALTER TABLE "mod_vocab_lists" ADD CONSTRAINT "mod_vocab_lists_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_list_words" ADD CONSTRAINT "mod_vocab_list_words_listId_fkey" FOREIGN KEY ("listId") REFERENCES "mod_vocab_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_listId_fkey" FOREIGN KEY ("listId") REFERENCES "mod_vocab_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_learnerUserId_fkey" FOREIGN KEY ("learnerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_learningId_fkey" FOREIGN KEY ("learningId") REFERENCES "mod_vocab_learnings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_listWordId_fkey" FOREIGN KEY ("listWordId") REFERENCES "mod_vocab_list_words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_sessions" ADD CONSTRAINT "mod_vocab_sessions_learningId_fkey" FOREIGN KEY ("learningId") REFERENCES "mod_vocab_learnings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_attempts" ADD CONSTRAINT "mod_vocab_attempts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "mod_vocab_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_attempts" ADD CONSTRAINT "mod_vocab_attempts_listWordId_fkey" FOREIGN KEY ("listWordId") REFERENCES "mod_vocab_list_words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_attempt_choices" ADD CONSTRAINT "mod_vocab_attempt_choices_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "mod_vocab_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_attempt_choices" ADD CONSTRAINT "mod_vocab_attempt_choices_sourceListWordId_fkey" FOREIGN KEY ("sourceListWordId") REFERENCES "mod_vocab_list_words"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_vocab_daily_practice" ADD CONSTRAINT "mod_vocab_daily_practice_learnerUserId_fkey" FOREIGN KEY ("learnerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint (nonnegative counters/values not expressible in Prisma schema syntax)
ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_dailyGoalSeconds_nonneg" CHECK ("dailyGoalSeconds" >= 0);
ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_gradedAnswerCount_nonneg" CHECK ("gradedAnswerCount" >= 0);
ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_correctAnswerCount_nonneg" CHECK ("correctAnswerCount" >= 0);
ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_incorrectAnswerCount_nonneg" CHECK ("incorrectAnswerCount" >= 0);
ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_servedCheckpointGroupCount_nonneg" CHECK ("servedCheckpointGroupCount" >= 0);

ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_definitionConsecutiveCorrect_nonneg" CHECK ("definitionConsecutiveCorrect" >= 0);
ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_spellingConsecutiveCorrect_nonneg" CHECK ("spellingConsecutiveCorrect" >= 0);
ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_practicePresentationCount_nonneg" CHECK ("practicePresentationCount" >= 0);
ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_totalCorrect_nonneg" CHECK ("totalCorrect" >= 0);
ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_totalIncorrect_nonneg" CHECK ("totalIncorrect" >= 0);
ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_nextReviewQuestionNumber_nonneg" CHECK ("nextReviewQuestionNumber" IS NULL OR "nextReviewQuestionNumber" >= 0);
ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_initialMasterySequence_nonneg" CHECK ("initialMasterySequence" IS NULL OR "initialMasterySequence" >= 0);

ALTER TABLE "mod_vocab_sessions" ADD CONSTRAINT "mod_vocab_sessions_stateVersion_nonneg" CHECK ("stateVersion" >= 0);
ALTER TABLE "mod_vocab_sessions" ADD CONSTRAINT "mod_vocab_sessions_activeSeconds_nonneg" CHECK ("activeSeconds" >= 0);
ALTER TABLE "mod_vocab_sessions" ADD CONSTRAINT "mod_vocab_sessions_gradedAnswerCount_nonneg" CHECK ("gradedAnswerCount" >= 0);
ALTER TABLE "mod_vocab_sessions" ADD CONSTRAINT "mod_vocab_sessions_correctAnswerCount_nonneg" CHECK ("correctAnswerCount" >= 0);
ALTER TABLE "mod_vocab_sessions" ADD CONSTRAINT "mod_vocab_sessions_incorrectAnswerCount_nonneg" CHECK ("incorrectAnswerCount" >= 0);

ALTER TABLE "mod_vocab_attempt_choices" ADD CONSTRAINT "mod_vocab_attempt_choices_position_nonneg" CHECK ("position" >= 0);

ALTER TABLE "mod_vocab_daily_practice" ADD CONSTRAINT "mod_vocab_daily_practice_goalSeconds_nonneg" CHECK ("goalSeconds" >= 0);
ALTER TABLE "mod_vocab_daily_practice" ADD CONSTRAINT "mod_vocab_daily_practice_secondsStudied_nonneg" CHECK ("secondsStudied" >= 0);
ALTER TABLE "mod_vocab_daily_practice" ADD CONSTRAINT "mod_vocab_daily_practice_questionsAnswered_nonneg" CHECK ("questionsAnswered" >= 0);
ALTER TABLE "mod_vocab_daily_practice" ADD CONSTRAINT "mod_vocab_daily_practice_correctAnswers_nonneg" CHECK ("correctAnswers" >= 0);
ALTER TABLE "mod_vocab_daily_practice" ADD CONSTRAINT "mod_vocab_daily_practice_correctAnswers_lte_questionsAnswered" CHECK ("correctAnswers" <= "questionsAnswered");
