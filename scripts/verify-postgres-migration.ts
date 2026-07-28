import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { env } from "@/lib/env";

type ExportPayload = {
  source: string;
  tables: Record<string, Record<string, unknown>[]>;
  counts: Record<string, number>;
};

type Issue = {
  table?: string;
  id?: unknown;
  field?: string;
  message: string;
};

const input = resolve(process.argv[2] ?? "migration-data/study-space-sqlite-export.json");
const payload = JSON.parse(readFileSync(input, "utf8")) as ExportPayload;
const sql = postgres(env.STUDY_SPACE_DATABASE_URL, { max: 1 });

const sourceTables = [
  "users",
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

const timestampFields = new Set([
  "created_at",
  "updated_at",
  "email_verification_sent_at",
  "pending_email_sent_at",
  "password_reset_sent_at",
  "started_at",
  "ended_at",
  "joined_at",
  "unlocked_at",
  "reminder_at",
]);

const exactFields: Record<string, string[]> = {
  users: [
    "id",
    "username",
    "email",
    "password_hash",
    "course",
    "bio",
    "profile_pic",
    "streak_days",
    "total_hours",
    "email_verified",
    "email_verification_token_hash",
    "pending_email",
    "pending_email_token_hash",
    "password_reset_token_hash",
  ],
  user_profiles: [
    "id",
    "user_id",
    "display_name",
    "bio",
    "profile_pic",
    "course",
    "institution",
    "education_level",
    "field_of_study",
    "country",
    "profile_visibility",
    "show_email",
    "show_academic_profile",
  ],
  user_settings: [
    "id",
    "user_id",
    "theme",
    "language",
    "timezone",
    "reduced_motion",
    "high_contrast",
    "email_notifications",
    "study_reminders",
  ],
  security_events: ["id", "user_id", "event_type", "ip_address", "user_agent", "metadata_json"],
  notes: ["id", "user_id", "title", "content", "subject", "tags", "is_public", "is_favorite", "is_archived", "is_pinned", "likes"],
  tasks: ["id", "user_id", "task", "subject", "priority", "due_date", "completed", "archived"],
  events: ["id", "user_id", "name", "event_date", "notes"],
  study_sessions: ["id", "user_id", "duration_minutes"],
  flashcards: ["id", "user_id", "title", "is_public"],
  flashcard_cards: ["id", "flashcard_id", "front", "back"],
  groups: ["id", "name", "description", "created_by", "member_count"],
  group_members: ["id", "group_id", "user_id"],
  posts: ["id", "user_id", "group_id", "content"],
  comments: ["id", "user_id", "post_id", "content"],
  likes: ["id", "user_id", "note_id"],
  notifications: ["id", "user_id", "title", "message", "is_read"],
  achievements: ["id", "user_id", "title", "description"],
};

function normalizeBoolean(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  return Boolean(value);
}

function normalizeExact(field: string, value: unknown) {
  if (value === undefined || value === "") return null;
  if (
    field.startsWith("is_") ||
    field.startsWith("show_") ||
    ["completed", "archived", "email_verified", "reduced_motion", "high_contrast", "email_notifications", "study_reminders"].includes(field)
  ) {
    return normalizeBoolean(value);
  }
  if (field.endsWith("_date")) {
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }
  return value;
}

function timestampIsValid(value: unknown) {
  if (value === null || value === undefined || value === "") return true;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return !Number.isNaN(Date.parse(String(value).replace(" ", "T")));
}

function passwordHashSupported(hash: unknown) {
  return typeof hash === "string" && (hash.startsWith("scrypt:") || hash.startsWith("pbkdf2:"));
}

async function tableRows(table: string) {
  return (await sql`select * from ${sql(table)} order by id`) as Record<string, unknown>[];
}

async function countRows(table: string) {
  const result = await sql`select count(*)::int as count from ${sql(table)}`;
  return Number(result[0]?.count ?? 0);
}

async function duplicateRows(table: string, columns: string[]) {
  const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
  return sql.unsafe(`
    select ${quotedColumns}, count(*)::int as count
    from "${table}"
    group by ${quotedColumns}
    having count(*) > 1
  `);
}

async function main() {
  const issues: Issue[] = [];
  const countReport: Record<string, { source: number; postgres: number }> = {};

  for (const table of sourceTables) {
    const sourceRows = payload.tables[table] ?? [];
    const postgresRows = await tableRows(table);
    countReport[table] = { source: sourceRows.length, postgres: postgresRows.length };
    if (sourceRows.length !== postgresRows.length) {
      issues.push({ table, message: `count mismatch source=${sourceRows.length} postgres=${postgresRows.length}` });
    }

    const postgresById = new Map(postgresRows.map((row) => [String(row.id), row]));
    for (const sourceRow of sourceRows) {
      const postgresRow = postgresById.get(String(sourceRow.id));
      if (!postgresRow) {
        issues.push({ table, id: sourceRow.id, message: "missing PostgreSQL row for source id" });
        continue;
      }

      for (const field of exactFields[table] ?? ["id"]) {
        const sourceValue = normalizeExact(field, sourceRow[field]);
        const postgresValue = normalizeExact(field, postgresRow[field]);
        if (sourceValue !== postgresValue) {
          issues.push({
            table,
            id: sourceRow.id,
            field,
            message: `field mismatch source=${JSON.stringify(sourceValue)} postgres=${JSON.stringify(postgresValue)}`,
          });
        }
      }

      for (const field of timestampFields) {
        if (field in sourceRow || field in postgresRow) {
          const sourceNull = sourceRow[field] === null || sourceRow[field] === undefined || sourceRow[field] === "";
          const postgresNull = postgresRow[field] === null || postgresRow[field] === undefined || postgresRow[field] === "";
          if (sourceNull !== postgresNull) {
            issues.push({ table, id: sourceRow.id, field, message: "timestamp nullability mismatch" });
          }
          if (!timestampIsValid(sourceRow[field]) || !timestampIsValid(postgresRow[field])) {
            issues.push({ table, id: sourceRow.id, field, message: "timestamp value is not parseable" });
          }
        }
      }
    }
  }

  const uniqueChecks: Array<[string, string[]]> = [
    ["users", ["email"]],
    ["users", ["username"]],
    ["user_profiles", ["user_id"]],
    ["user_settings", ["user_id"]],
    ["group_members", ["group_id", "user_id"]],
    ["likes", ["user_id", "note_id"]],
  ];
  for (const [table, columns] of uniqueChecks) {
    const duplicates = await duplicateRows(table, columns);
    if (duplicates.length) issues.push({ table, field: columns.join(","), message: `duplicate unique values found: ${JSON.stringify(duplicates)}` });
  }

  const fkChecks: Array<[string, string]> = [
    ["notes", "select n.id from notes n left join users u on u.id = n.user_id where u.id is null"],
    ["tasks", "select t.id from tasks t left join users u on u.id = t.user_id where u.id is null"],
    ["events", "select e.id from events e left join users u on u.id = e.user_id where u.id is null"],
    ["user_profiles", "select p.id from user_profiles p left join users u on u.id = p.user_id where u.id is null"],
    ["user_settings", "select s.id from user_settings s left join users u on u.id = s.user_id where u.id is null"],
    ["flashcard_cards", "select c.id from flashcard_cards c left join flashcards f on f.id = c.flashcard_id where f.id is null"],
    ["group_members", "select gm.id from group_members gm left join groups g on g.id = gm.group_id left join users u on u.id = gm.user_id where g.id is null or u.id is null"],
    ["posts", "select p.id from posts p left join users u on u.id = p.user_id left join groups g on g.id = p.group_id where u.id is null or (p.group_id is not null and g.id is null)"],
    ["comments", "select c.id from comments c left join users u on u.id = c.user_id left join posts p on p.id = c.post_id where u.id is null or p.id is null"],
    ["likes", "select l.id from likes l left join users u on u.id = l.user_id left join notes n on n.id = l.note_id where u.id is null or n.id is null"],
  ];
  for (const [table, query] of fkChecks) {
    const broken = await sql.unsafe(query);
    if (broken.length) issues.push({ table, message: `broken foreign keys: ${JSON.stringify(broken)}` });
  }

  const users = await tableRows("users");
  const unsupportedPasswordUsers = users.filter((user) => !passwordHashSupported(user.password_hash));
  for (const user of unsupportedPasswordUsers) {
    issues.push({ table: "users", id: user.id, field: "password_hash", message: "password hash format is not supported by TypeScript verifier" });
  }

  const operationalCounts = {
    auth_rate_limits: await countRows("auth_rate_limits"),
    user_sessions: await countRows("user_sessions"),
    integration_tokens: await countRows("integration_tokens"),
  };

  const report = {
    source: payload.source,
    counts: countReport,
    operationalCounts,
    passwordHashCompatibility: {
      checked: users.length,
      supported: users.length - unsupportedPasswordUsers.length,
      unsupported: unsupportedPasswordUsers.length,
    },
    issues,
  };

  console.log(JSON.stringify(report, null, 2));
  if (issues.length) {
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  await sql.end();
}
