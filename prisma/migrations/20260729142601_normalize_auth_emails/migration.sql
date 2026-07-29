-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- AlterTable
-- citext defines an implicit cast from text, so existing byte content is
-- preserved by this type change alone; canonicalization happens below.
ALTER TABLE "EmailVerificationCode" ALTER COLUMN "email" SET DATA TYPE CITEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET DATA TYPE CITEXT;

-- Canonicalize existing data
-- Only rewrites rows whose stored bytes are not already trimmed+lowercased,
-- so already-canonical rows are left untouched. The Stage 4 live-database
-- preflight confirmed zero LOWER(BTRIM(...)) collision groups and zero
-- blank-after-trim emails before this migration was authored, so this
-- rewrite cannot create a new duplicate or an unusable blank identity.
UPDATE "User"
SET "email" = LOWER(BTRIM("email"::text))
WHERE "email" IS NOT NULL
  AND "email"::text <> LOWER(BTRIM("email"::text));

UPDATE "EmailVerificationCode"
SET "email" = LOWER(BTRIM("email"::text))
WHERE "email"::text <> LOWER(BTRIM("email"::text));

-- Enforce canonical storage going forward
-- citext equality is case-insensitive, so both sides are cast to text for an
-- exact byte comparison -- otherwise a differently-cased value would satisfy
-- this check against its own canonical form and the constraint would enforce
-- nothing.
ALTER TABLE "User"
  ADD CONSTRAINT "User_email_canonical_check"
  CHECK ("email" IS NULL OR "email"::text = LOWER(BTRIM("email"::text)));

ALTER TABLE "EmailVerificationCode"
  ADD CONSTRAINT "EmailVerificationCode_email_canonical_check"
  CHECK ("email"::text = LOWER(BTRIM("email"::text)));
