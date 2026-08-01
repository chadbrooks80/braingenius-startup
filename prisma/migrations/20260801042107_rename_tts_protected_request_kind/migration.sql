-- Rename the subject-specific "VOCABULARY_PROTECTED" enum value to the
-- subject-neutral "PROTECTED_TEXT" so the shared TTS usage-accounting layer
-- no longer names a specific learning module. ALTER TYPE ... RENAME VALUE
-- relabels the existing enum member in place, so rows already stored with
-- the old value transparently read back with the new one.
ALTER TYPE "TtsRequestKind" RENAME VALUE 'VOCABULARY_PROTECTED' TO 'PROTECTED_TEXT';
