import postgres from "postgres";
import "./load-env";
import { env } from "../lib/env";

const databaseUrl = process.env.STUDY_SPACE_DATABASE_URL || env.STUDY_SPACE_DATABASE_URL;
if (!databaseUrl) throw new Error("STUDY_SPACE_DATABASE_URL is required.");

const apply = process.argv.includes("--apply");
const batchArgument = process.argv.find((argument) => argument.startsWith("--batch-size="));
const batchSize = Number(batchArgument?.split("=")[1] ?? 5000);
if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 50_000) {
  throw new Error("--batch-size must be an integer between 1 and 50000.");
}

const now = new Date();
const before = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
const sql = postgres(databaseUrl, { max: 1 });

async function eligibleCounts() {
  const [row] = await sql<{
    sessions: number;
    rate_limits: number;
    password_resets: number;
    email_changes: number;
    email_verifications: number;
  }[]>`
    select
      (select count(*)::int from user_sessions
        where expires_at <= ${now} or revoked_at <= ${before(24 * 7)}) as sessions,
      (select count(*)::int from auth_rate_limits
        where updated_at <= ${before(24)}) as rate_limits,
      (select count(*)::int from users
        where password_reset_token_hash is not null
          and (password_reset_sent_at is null or password_reset_sent_at <= ${before(2)})) as password_resets,
      (select count(*)::int from users
        where pending_email_token_hash is not null
          and (pending_email_sent_at is null or pending_email_sent_at <= ${before(24)})) as email_changes,
      (select count(*)::int from users
        where email_verification_token_hash is not null
          and (email_verification_sent_at is null or email_verification_sent_at <= ${before(48)})) as email_verifications
  `;
  return row;
}

async function cleanup() {
  return sql.begin(async (tx) => {
    const [lock] = await tx<{ acquired: boolean }[]>`
      select pg_try_advisory_xact_lock(1937016942) as acquired
    `;
    if (!lock?.acquired) throw new Error("Another auth cleanup is already running.");

    const sessions = await tx`
      with candidates as (
        select id from user_sessions
        where expires_at <= ${now} or revoked_at <= ${before(24 * 7)}
        order by id limit ${batchSize}
      )
      delete from user_sessions where id in (select id from candidates)
      returning id
    `;
    const rateLimits = await tx`
      with candidates as (
        select id from auth_rate_limits
        where updated_at <= ${before(24)}
        order by id limit ${batchSize}
      )
      delete from auth_rate_limits where id in (select id from candidates)
      returning id
    `;
    const passwordResets = await tx`
      with candidates as (
        select id from users
        where password_reset_token_hash is not null
          and (password_reset_sent_at is null or password_reset_sent_at <= ${before(2)})
        order by id limit ${batchSize}
      )
      update users set password_reset_token_hash = null, password_reset_sent_at = null
      where id in (select id from candidates) returning id
    `;
    const emailChanges = await tx`
      with candidates as (
        select id from users
        where pending_email_token_hash is not null
          and (pending_email_sent_at is null or pending_email_sent_at <= ${before(24)})
        order by id limit ${batchSize}
      )
      update users set pending_email = null, pending_email_token_hash = null, pending_email_sent_at = null
      where id in (select id from candidates) returning id
    `;
    const emailVerifications = await tx`
      with candidates as (
        select id from users
        where email_verification_token_hash is not null
          and (email_verification_sent_at is null or email_verification_sent_at <= ${before(48)})
        order by id limit ${batchSize}
      )
      update users set email_verification_token_hash = null, email_verification_sent_at = null
      where id in (select id from candidates) returning id
    `;

    return {
      sessions: sessions.length,
      rate_limits: rateLimits.length,
      password_resets: passwordResets.length,
      email_changes: emailChanges.length,
      email_verifications: emailVerifications.length,
    };
  });
}

try {
  const eligible = await eligibleCounts();
  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", asOf: now.toISOString(), eligible }, null, 2));
    console.log("No records changed. Re-run with --apply to delete/clear one bounded batch.");
  } else {
    const changed = await cleanup();
    console.log(JSON.stringify({ mode: "apply", asOf: now.toISOString(), batchSize, eligible, changed }, null, 2));
  }
} finally {
  await sql.end();
}
