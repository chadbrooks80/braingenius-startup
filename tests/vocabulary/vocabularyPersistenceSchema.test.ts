import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const SCHEMA_PATH = path.join(REPO_ROOT, "prisma/schema.prisma");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "prisma/migrations");
const MIGRATION_SUFFIX = "_add_mod_vocab_tables";

const EXPECTED_TABLES = [
  "mod_vocab_lists",
  "mod_vocab_list_words",
  "mod_vocab_learnings",
  "mod_vocab_word_progress",
  "mod_vocab_sessions",
  "mod_vocab_attempts",
  "mod_vocab_attempt_choices",
  "mod_vocab_daily_practice",
];

const LIST_WORD_CONTENT_FIELDS = [
  "word",
  "definition",
  "spellingDefinition",
  "exampleSentence1",
  "exampleSentence2",
  "exampleSentence3",
  "interestingFact",
];

async function loadSchema(): Promise<string> {
  return readFile(SCHEMA_PATH, "utf8");
}

async function loadMigrationSql(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const migrationDir = entries.find(
    (entry) => entry.isDirectory() && entry.name.endsWith(MIGRATION_SUFFIX)
  );
  assert.ok(
    migrationDir,
    `expected a migration directory ending in "${MIGRATION_SUFFIX}"`
  );
  return readFile(
    path.join(MIGRATIONS_DIR, migrationDir!.name, "migration.sql"),
    "utf8"
  );
}

function extractCreateTableNames(sql: string): string[] {
  const matches = sql.matchAll(/CREATE TABLE "([^"]+)"/g);
  return Array.from(matches, (match) => match[1]);
}

test("all eight mod_vocab tables are created and every created table is prefixed", async () => {
  const sql = await loadMigrationSql();
  const createdTables = extractCreateTableNames(sql);

  for (const table of EXPECTED_TABLES) {
    assert.ok(
      createdTables.includes(table),
      `expected migration to create table "${table}"`
    );
  }
  assert.equal(createdTables.length, EXPECTED_TABLES.length);

  for (const table of createdTables) {
    assert.ok(
      table.startsWith("mod_vocab_"),
      `table "${table}" must start with mod_vocab_`
    );
  }
});

test("schema maps every ModVocab model to its expected mod_vocab_ table", async () => {
  const schema = await loadSchema();

  for (const table of EXPECTED_TABLES) {
    assert.match(
      schema,
      new RegExp(`@@map\\("${table}"\\)`),
      `expected schema to map a model to "${table}"`
    );
  }
});

test("no implicit unprefixed join table is created", async () => {
  const sql = await loadMigrationSql();
  const createdTables = extractCreateTableNames(sql);

  // Prisma names implicit many-to-many join tables starting with "_".
  assert.ok(
    createdTables.every((table) => !table.startsWith("_")),
    "migration must not create an implicit Prisma join table"
  );
  assert.ok(
    createdTables.every((table) => table.startsWith("mod_vocab_")),
    "migration must not create a table outside the mod_vocab_ prefix"
  );
});

test("list-word model stores the complete editable content snapshot", async () => {
  const schema = await loadSchema();
  const listWordModel = extractModelBlock(schema, "ModVocabListWord");

  for (const field of LIST_WORD_CONTENT_FIELDS) {
    assert.match(
      listWordModel,
      new RegExp(`\\b${field}\\b`),
      `expected ModVocabListWord to declare "${field}"`
    );
  }
  assert.match(listWordModel, /contentSource\s+ModVocabContentSource/);
  assert.match(listWordModel, /contentResolvedAt\s+DateTime\?/);
});

test("list-word ordering and duplicate-prevention constraints exist", async () => {
  const sql = await loadMigrationSql();
  assert.match(
    sql,
    /CREATE UNIQUE INDEX "mod_vocab_list_words_listId_position_key" ON "mod_vocab_list_words"\("listId", "position"\)/
  );
  assert.match(
    sql,
    /CREATE UNIQUE INDEX "mod_vocab_list_words_listId_normalizedWord_key" ON "mod_vocab_list_words"\("listId", "normalizedWord"\)/
  );
  assert.match(
    sql,
    /CREATE INDEX "mod_vocab_list_words_listId_position_idx" ON "mod_vocab_list_words"\("listId", "position"\)/
  );
});

test("learner/list progress uniqueness exists", async () => {
  const sql = await loadMigrationSql();
  assert.match(
    sql,
    /CREATE UNIQUE INDEX "mod_vocab_word_progress_learningId_listWordId_key" ON "mod_vocab_word_progress"\("learningId", "listWordId"\)/
  );
});

test("initial-mastery sequence uniqueness exists", async () => {
  const sql = await loadMigrationSql();
  assert.match(
    sql,
    /CREATE UNIQUE INDEX "mod_vocab_word_progress_learningId_initialMasterySequence_key" ON "mod_vocab_word_progress"\("learningId", "initialMasterySequence"\)/
  );
});

test("daily-practice date uniqueness and answer counters exist", async () => {
  const sql = await loadMigrationSql();
  assert.match(
    sql,
    /CREATE UNIQUE INDEX "mod_vocab_daily_practice_learnerUserId_practiceDate_key" ON "mod_vocab_daily_practice"\("learnerUserId", "practiceDate"\)/
  );

  const schema = await loadSchema();
  const dailyPracticeModel = extractModelBlock(schema, "ModVocabDailyPractice");
  assert.match(dailyPracticeModel, /questionsAnswered\s+Int/);
  assert.match(dailyPracticeModel, /correctAnswers\s+Int/);
});

test("attempt and attempt-choice IDs use UUID-compatible defaults", async () => {
  const schema = await loadSchema();
  const sessionModel = extractModelBlock(schema, "ModVocabSession");
  const attemptModel = extractModelBlock(schema, "ModVocabAttempt");
  const attemptChoiceModel = extractModelBlock(schema, "ModVocabAttemptChoice");

  assert.match(sessionModel, /id\s+String\s+@id\s+@default\(uuid\(\)\)/);
  assert.match(attemptModel, /id\s+String\s+@id\s+@default\(uuid\(\)\)/);
  assert.match(attemptChoiceModel, /id\s+String\s+@id\s+@default\(uuid\(\)\)/);
});

test("required foreign-key deletion actions exist", async () => {
  const sql = await loadMigrationSql();

  const expectedCascades: Array<[string, string]> = [
    ["mod_vocab_lists", "mod_vocab_lists_ownerUserId_fkey"],
    ["mod_vocab_list_words", "mod_vocab_list_words_listId_fkey"],
    ["mod_vocab_learnings", "mod_vocab_learnings_listId_fkey"],
    ["mod_vocab_learnings", "mod_vocab_learnings_learnerUserId_fkey"],
    ["mod_vocab_word_progress", "mod_vocab_word_progress_learningId_fkey"],
    ["mod_vocab_word_progress", "mod_vocab_word_progress_listWordId_fkey"],
    ["mod_vocab_sessions", "mod_vocab_sessions_learningId_fkey"],
    ["mod_vocab_attempts", "mod_vocab_attempts_sessionId_fkey"],
    ["mod_vocab_attempts", "mod_vocab_attempts_listWordId_fkey"],
    ["mod_vocab_attempt_choices", "mod_vocab_attempt_choices_attemptId_fkey"],
    ["mod_vocab_daily_practice", "mod_vocab_daily_practice_learnerUserId_fkey"],
  ];
  for (const [table, constraintName] of expectedCascades) {
    const statement = extractForeignKeyStatement(sql, table, constraintName);
    assert.match(
      statement,
      /ON DELETE CASCADE/,
      `expected ${constraintName} on ${table} to cascade`
    );
  }

  const expectedSetNulls: Array<[string, string]> = [
    ["mod_vocab_learnings", "mod_vocab_learnings_assignedByUserId_fkey"],
    [
      "mod_vocab_attempt_choices",
      "mod_vocab_attempt_choices_sourceListWordId_fkey",
    ],
  ];
  for (const [table, constraintName] of expectedSetNulls) {
    const statement = extractForeignKeyStatement(sql, table, constraintName);
    assert.match(
      statement,
      /ON DELETE SET NULL/,
      `expected ${constraintName} on ${table} to set null`
    );
  }
});

test("required nonnegative and daily-answer-consistency check constraints exist", async () => {
  const sql = await loadMigrationSql();

  const nonnegativeChecks = [
    `ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_dailyGoalSeconds_nonneg" CHECK ("dailyGoalSeconds" >= 0);`,
    `ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_gradedAnswerCount_nonneg" CHECK ("gradedAnswerCount" >= 0);`,
    `ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_correctAnswerCount_nonneg" CHECK ("correctAnswerCount" >= 0);`,
    `ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_incorrectAnswerCount_nonneg" CHECK ("incorrectAnswerCount" >= 0);`,
    `ALTER TABLE "mod_vocab_learnings" ADD CONSTRAINT "mod_vocab_learnings_servedCheckpointGroupCount_nonneg" CHECK ("servedCheckpointGroupCount" >= 0);`,
    `ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_definitionConsecutiveCorrect_nonneg" CHECK ("definitionConsecutiveCorrect" >= 0);`,
    `ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_spellingConsecutiveCorrect_nonneg" CHECK ("spellingConsecutiveCorrect" >= 0);`,
    `ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_practicePresentationCount_nonneg" CHECK ("practicePresentationCount" >= 0);`,
    `ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_totalCorrect_nonneg" CHECK ("totalCorrect" >= 0);`,
    `ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_totalIncorrect_nonneg" CHECK ("totalIncorrect" >= 0);`,
    `ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_nextReviewQuestionNumber_nonneg" CHECK ("nextReviewQuestionNumber" IS NULL OR "nextReviewQuestionNumber" >= 0);`,
    `ALTER TABLE "mod_vocab_word_progress" ADD CONSTRAINT "mod_vocab_word_progress_initialMasterySequence_nonneg" CHECK ("initialMasterySequence" IS NULL OR "initialMasterySequence" >= 0);`,
    `ALTER TABLE "mod_vocab_sessions" ADD CONSTRAINT "mod_vocab_sessions_stateVersion_nonneg" CHECK ("stateVersion" >= 0);`,
    `ALTER TABLE "mod_vocab_sessions" ADD CONSTRAINT "mod_vocab_sessions_activeSeconds_nonneg" CHECK ("activeSeconds" >= 0);`,
    `ALTER TABLE "mod_vocab_sessions" ADD CONSTRAINT "mod_vocab_sessions_gradedAnswerCount_nonneg" CHECK ("gradedAnswerCount" >= 0);`,
    `ALTER TABLE "mod_vocab_sessions" ADD CONSTRAINT "mod_vocab_sessions_correctAnswerCount_nonneg" CHECK ("correctAnswerCount" >= 0);`,
    `ALTER TABLE "mod_vocab_sessions" ADD CONSTRAINT "mod_vocab_sessions_incorrectAnswerCount_nonneg" CHECK ("incorrectAnswerCount" >= 0);`,
    `ALTER TABLE "mod_vocab_attempt_choices" ADD CONSTRAINT "mod_vocab_attempt_choices_position_nonneg" CHECK ("position" >= 0);`,
    `ALTER TABLE "mod_vocab_daily_practice" ADD CONSTRAINT "mod_vocab_daily_practice_goalSeconds_nonneg" CHECK ("goalSeconds" >= 0);`,
    `ALTER TABLE "mod_vocab_daily_practice" ADD CONSTRAINT "mod_vocab_daily_practice_secondsStudied_nonneg" CHECK ("secondsStudied" >= 0);`,
    `ALTER TABLE "mod_vocab_daily_practice" ADD CONSTRAINT "mod_vocab_daily_practice_questionsAnswered_nonneg" CHECK ("questionsAnswered" >= 0);`,
    `ALTER TABLE "mod_vocab_daily_practice" ADD CONSTRAINT "mod_vocab_daily_practice_correctAnswers_nonneg" CHECK ("correctAnswers" >= 0);`,
  ];
  for (const statement of nonnegativeChecks) {
    assert.ok(sql.includes(statement), `expected migration to include: ${statement}`);
  }

  assert.match(
    sql,
    /ADD CONSTRAINT "mod_vocab_daily_practice_correctAnswers_lte_questionsAnswered" CHECK \("correctAnswers" <= "questionsAnswered"\);/
  );
});

test("the migration contains no data-seeding statements", async () => {
  const sql = await loadMigrationSql();
  assert.doesNotMatch(sql, /^\s*INSERT\s+INTO/im);
  assert.doesNotMatch(sql, /^\s*UPDATE\s+"mod_vocab_/im);
  assert.doesNotMatch(sql, /^\s*DELETE\s+FROM/im);
  assert.doesNotMatch(sql, /DROP TABLE/i);
  assert.doesNotMatch(sql, /ALTER TABLE "User"/);
});

function extractModelBlock(schema: string, modelName: string): string {
  const match = schema.match(
    new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`)
  );
  assert.ok(match, `expected schema to declare model ${modelName}`);
  return match![1];
}

function extractForeignKeyStatement(
  sql: string,
  table: string,
  constraintName: string
): string {
  const pattern = new RegExp(
    `ALTER TABLE "${table}" ADD CONSTRAINT "${constraintName}"[^;]*;`
  );
  const match = sql.match(pattern);
  assert.ok(match, `expected migration to define foreign key "${constraintName}"`);
  return match![0];
}
