import { readFile } from "node:fs/promises";
import postgres from "postgres";
import "./load-env";
import { env } from "../lib/env";

type MigrationJournal = {
  entries: Array<{ idx: number; tag: string; when: number }>;
};

const databaseUrl =
  process.env.STUDY_SPACE_DATABASE_URL || env.STUDY_SPACE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "STUDY_SPACE_DATABASE_URL is required for migration verification.",
  );
}

const journal = JSON.parse(
  await readFile(
    new URL("../drizzle/meta/_journal.json", import.meta.url),
    "utf8",
  ),
) as MigrationJournal;

const requiredTables = [
  "academic_deadlines",
  "academic_subjects",
  "academic_topics",
  "auth_rate_limits",
  "events",
  "flashcards",
  "notes",
  "study_materials",
  "tasks",
  "user_sessions",
  "users",
];

const sql = postgres(databaseUrl, { max: 1 });

try {
  const migrationRows = await sql<{ created_at: string }[]>`
    select created_at::text as created_at
    from drizzle.__drizzle_migrations
    order by created_at asc
  `;
  const appliedMigrations = migrationRows.length;

  if (appliedMigrations !== journal.entries.length) {
    throw new Error(
      `Expected ${journal.entries.length} applied migrations, found ${appliedMigrations}.`,
    );
  }

  const expectedMigrationTimes = journal.entries.map((entry) =>
    String(entry.when),
  );
  const appliedMigrationTimes = migrationRows.map((row) => row.created_at);
  if (
    appliedMigrationTimes.some(
      (createdAt, index) => createdAt !== expectedMigrationTimes[index],
    )
  ) {
    throw new Error(
      "Applied migration history does not match the committed Drizzle journal.",
    );
  }

  const tables = await sql<{ table_name: string }[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
  `;
  const tableNames = new Set(tables.map((row) => row.table_name));
  const missingTables = requiredTables.filter(
    (table) => !tableNames.has(table),
  );

  if (missingTables.length > 0) {
    throw new Error(
      `Fresh migration is missing tables: ${missingTables.join(", ")}`,
    );
  }

  const invalidConstraints = await sql<{ constraint_name: string }[]>`
    select conname as constraint_name
    from pg_constraint constraint_record
    join pg_namespace namespace_record on namespace_record.oid = constraint_record.connamespace
    where constraint_record.contype = 'f'
      and not constraint_record.convalidated
      and namespace_record.nspname = 'public'
  `;

  if (invalidConstraints.length > 0) {
    throw new Error(
      `Fresh migration has unvalidated foreign keys: ${invalidConstraints
        .map((row) => row.constraint_name)
        .join(", ")}`,
    );
  }

  console.log(
    `Fresh PostgreSQL migration verified: ${appliedMigrations} migrations, ${tableNames.size} public tables.`,
  );
} finally {
  await sql.end();
}
