import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const SCHEMA_PATH = path.join(REPO_ROOT, "prisma/schema.prisma");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "prisma/migrations");
const MIGRATION_SUFFIX = "_add_mod_vocab_runtime_records";

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

function extractModelBlock(schema: string, modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `expected schema to declare model ${modelName}`);
  return match![1];
}

test("the migration creates the runtime-record enum and table", async () => {
  const sql = await loadMigrationSql();
  assert.match(
    sql,
    /CREATE TYPE "mod_vocab_runtime_record_kind" AS ENUM \('LESSON', 'CAPABILITY', 'ATTEMPT'\);/
  );
  assert.match(sql, /CREATE TABLE "mod_vocab_runtime_records"/);
});

test("schema declares the enum and model mapped to their expected tables", async () => {
  const schema = await loadSchema();
  assert.match(schema, /@@map\("mod_vocab_runtime_record_kind"\)/);
  assert.match(schema, /@@map\("mod_vocab_runtime_records"\)/);

  const model = extractModelBlock(schema, "ModVocabRuntimeRecord");
  for (const field of [
    "recordKind",
    "id",
    "lessonId",
    "learnerId",
    "wordListId",
    "payload",
    "stateVersion",
    "expiresAt",
  ]) {
    assert.match(model, new RegExp(`\\b${field}\\b`), `expected field "${field}"`);
  }
  assert.match(model, /payload\s+Json/);
  assert.match(model, /stateVersion\s+Int\s+@default\(0\)/);
});

test("the compound primary key scopes id by recordKind, not globally", async () => {
  const schema = await loadSchema();
  const model = extractModelBlock(schema, "ModVocabRuntimeRecord");
  assert.match(model, /@@id\(\[recordKind, id\]\)/);

  const sql = await loadMigrationSql();
  assert.match(
    sql,
    /CONSTRAINT "mod_vocab_runtime_records_pkey" PRIMARY KEY \("recordKind","id"\)/
  );
});

test("required lookup indexes exist for lesson, learner, list, and expiry", async () => {
  const sql = await loadMigrationSql();
  assert.match(
    sql,
    /CREATE INDEX "mod_vocab_runtime_records_lessonId_recordKind_idx" ON "mod_vocab_runtime_records"\("lessonId", "recordKind"\)/
  );
  assert.match(
    sql,
    /CREATE INDEX "mod_vocab_runtime_records_learnerId_lessonId_idx" ON "mod_vocab_runtime_records"\("learnerId", "lessonId"\)/
  );
  assert.match(
    sql,
    /CREATE INDEX "mod_vocab_runtime_records_wordListId_idx" ON "mod_vocab_runtime_records"\("wordListId"\)/
  );
  assert.match(
    sql,
    /CREATE INDEX "mod_vocab_runtime_records_expiresAt_idx" ON "mod_vocab_runtime_records"\("expiresAt"\)/
  );
});

test("the wordListId foreign key cascades on delete", async () => {
  const sql = await loadMigrationSql();
  const match = sql.match(
    /ALTER TABLE "mod_vocab_runtime_records" ADD CONSTRAINT "mod_vocab_runtime_records_wordListId_fkey"[^;]*;/
  );
  assert.ok(match, "expected the wordListId foreign key");
  assert.match(match![0], /REFERENCES "mod_vocab_lists"\("id"\)/);
  assert.match(match![0], /ON DELETE CASCADE/);
});

test("ModVocabList declares the reverse runtimeRecords relation", async () => {
  const schema = await loadSchema();
  const model = extractModelBlock(schema, "ModVocabList");
  assert.match(model, /runtimeRecords\s+ModVocabRuntimeRecord\[\]/);
});

test("the migration contains no data-seeding or destructive statements", async () => {
  const sql = await loadMigrationSql();
  assert.doesNotMatch(sql, /^\s*INSERT\s+INTO/im);
  assert.doesNotMatch(sql, /^\s*UPDATE\s+"/im);
  assert.doesNotMatch(sql, /^\s*DELETE\s+FROM/im);
  assert.doesNotMatch(sql, /DROP TABLE/i);
  assert.doesNotMatch(sql, /ALTER TABLE "mod_vocab_lists"/);
  assert.doesNotMatch(sql, /ALTER TABLE "mod_vocab_list_words"/);
});
