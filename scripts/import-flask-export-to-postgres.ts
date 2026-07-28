import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { env } from "@/lib/env";

type ExportPayload = {
  exportedAt: string;
  source: string;
  tables: Record<string, Record<string, unknown>[]>;
  counts: Record<string, number>;
};

const input = resolve(process.argv[2] ?? "migration-data/study-space-sqlite-export.json");
const payload = JSON.parse(readFileSync(input, "utf8")) as ExportPayload;

const tableOrder = [
  "users",
  "auth_rate_limits",
  "user_profiles",
  "user_settings",
  "security_events",
  "notes",
  "flashcards",
  "flashcard_cards",
  "study_sessions",
  "groups",
  "group_members",
  "posts",
  "comments",
  "likes",
  "notifications",
  "achievements",
  "events",
  "tasks",
] as const;

const sql = postgres(env.STUDY_SPACE_DATABASE_URL, { max: 1 });

function normalizeDate(value: unknown) {
  if (value === "" || value === undefined) {
    return null;
  }
  return value;
}

function normalizeBoolean(value: unknown) {
  if (value === null || value === undefined) {
    return value;
  }
  return Boolean(value);
}

function normalizeRow(row: Record<string, unknown>) {
  const next = { ...row };
  for (const [key, value] of Object.entries(next)) {
    if (key.endsWith("_at") || key.endsWith("_date")) {
      next[key] = normalizeDate(value);
    }
    if (key.startsWith("is_") || key.startsWith("show_") || key === "completed" || key === "archived" || key === "email_verified" || key === "reduced_motion" || key === "high_contrast" || key === "email_notifications" || key === "study_reminders") {
      next[key] = normalizeBoolean(value);
    }
  }
  return next;
}

try {
  await sql.begin(async (tx) => {
    await tx`set constraints all deferred`;
    for (const table of [...tableOrder].reverse()) {
      await tx`delete from ${tx(table)}`;
    }
    for (const table of tableOrder) {
      const rows = payload.tables[table] ?? [];
      if (rows.length === 0) {
        continue;
      }
      const normalizedRows = rows.map(normalizeRow);
      await tx`insert into ${tx(table)} ${tx(normalizedRows)}`;
      const maxId = normalizedRows.reduce((max, row) => Math.max(max, Number(row.id ?? 0)), 0);
      if (maxId > 0) {
        await tx.unsafe(`select setval(pg_get_serial_sequence('${table}', 'id'), ${maxId}, true)`);
      }
    }
  });

  const actualCounts: Record<string, number> = {};
  for (const table of tableOrder) {
    const result = await sql`select count(*)::int as count from ${sql(table)}`;
    actualCounts[table] = Number(result[0]?.count ?? 0);
  }

  const mismatches = tableOrder.filter((table) => actualCounts[table] !== (payload.counts[table] ?? 0));
  if (mismatches.length > 0) {
    throw new Error(`Imported row count mismatch: ${mismatches.join(", ")}`);
  }

  console.log(`Imported export from ${payload.source}`);
  console.log(JSON.stringify(actualCounts, null, 2));
} finally {
  await sql.end();
}
