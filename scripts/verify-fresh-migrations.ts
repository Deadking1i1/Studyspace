import { spawnSync } from "node:child_process";
import postgres from "postgres";
import "./load-env";

const databaseUrl = process.env.STUDY_SPACE_FRESH_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("STUDY_SPACE_FRESH_DATABASE_URL must point to a dedicated empty CI/test PostgreSQL database.");
}

const parsed = new URL(databaseUrl);
const databaseName = parsed.pathname.slice(1);
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
if (!isLocal && !/(^|[_-])(ci|test)([_-]|$)/i.test(databaseName)) {
  throw new Error("Refusing to migrate a non-local database whose name is not clearly marked ci/test.");
}

const sql = postgres(databaseUrl, { max: 1 });
try {
  const existing = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `;
  if (existing.length) {
    throw new Error(`Fresh migration database is not empty: ${existing.map((row) => row.table_name).join(", ")}`);
  }
} finally {
  await sql.end();
}

function runNpm(script: string) {
  const result = spawnSync(`npm run ${script}`, {
    cwd: process.cwd(),
    env: { ...process.env, STUDY_SPACE_DATABASE_URL: databaseUrl },
    encoding: "utf8",
    stdio: "pipe",
    shell: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runNpm("db:migrate");
runNpm("db:verify-applied");
console.log(`Fresh migration chain verified against isolated database ${databaseName}.`);
