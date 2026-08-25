# Database Backup and Recovery Runbook

This runbook covers the PostgreSQL database used by the Study Space private beta. Object-storage backups are a separate concern.

## Recovery Objectives

- Private-beta target RPO: 24 hours maximum; prefer managed continuous/PITR backups.
- Private-beta target RTO: 4 hours.
- Keep at least 14 daily backups and provider-managed point-in-time recovery where available.
- Backups must be encrypted, access-controlled, and stored outside the application runtime.

## Required Controls

1. Enable the managed provider's automated backups and point-in-time recovery before inviting users.
2. Restrict backup/restore credentials to operators; the application role must not create databases or manage backups.
3. Never place database URLs, dumps, or restored user data in Git, shared chat, or application logs.
4. Run a restore rehearsal before beta and at least monthly during beta.
5. Record provider, backup identifier, timestamps, operator, row-count checks, and outcome in the incident log.

## Logical Backup

Use a direct (non-pooler) PostgreSQL URL with TLS. Keep passwords out of command history by using the provider's supported credential mechanism or a temporary `PGPASSFILE`.

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
pg_dump --dbname "$env:STUDY_SPACE_DATABASE_DIRECT_URL" --format=custom --no-owner --no-acl --file "study-space-$stamp.dump"
pg_restore --list "study-space-$stamp.dump" | Select-Object -First 20
```

Encrypt the dump immediately and move it to access-controlled backup storage. A successful command is not proof of recoverability; only a restore rehearsal is.

## Restore Rehearsal

Always restore into a new, isolated database. Never test a restore over production.

1. Create an empty database named clearly as a restore test, such as `study_space_restore_test`.
2. Disable application access to that database and restrict network access to the operator.
3. Restore and stop on SQL errors:

```powershell
pg_restore --dbname "$env:STUDY_SPACE_RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-acl --exit-on-error "study-space-YYYYMMDD-HHMMSS.dump"
```

4. Verify migration history, core table counts, foreign keys, and representative user-owned records.
5. Run `npm run db:check` against the repository schema metadata.
6. Point `STUDY_SPACE_FRESH_DATABASE_URL` at a separate empty test database and run `npm run db:verify-fresh` to prove the migration chain independently.
7. Destroy the restored database and any local dump after the evidence is recorded.

Useful verification SQL:

```sql
select count(*) from drizzle.__drizzle_migrations;
select count(*) from users;
select count(*) from user_sessions where user_id not in (select id from users);
select count(*) from notes where user_id not in (select id from users);
select count(*) from tasks where user_id not in (select id from users);
```

All orphan counts must be zero. Compare core table counts with the backup-time monitoring snapshot when one is available.

`db:verify-fresh` refuses a non-empty target. For a remote target, its database name must contain a distinct `ci` or `test` segment. CI should provision a disposable empty PostgreSQL database, set `STUDY_SPACE_FRESH_DATABASE_URL`, run the command, and destroy the database after the job. Use `npm run db:verify-applied` when checking a database whose migrations have already been applied.

## Production Recovery

1. Declare the incident, record the recovery point, and stop writes by placing the application in maintenance mode or scaling it to zero.
2. Preserve logs and the damaged database; do not run destructive repair commands against the only copy.
3. Prefer provider point-in-time recovery into a new database immediately before the destructive event.
4. Run the restore verification checks above against the recovered database.
5. Rotate the production database credential and update the deployment secret to the recovered database URL.
6. Apply only repository migrations newer than the restored migration history.
7. Start one application instance, run health/auth smoke checks, then restore normal capacity.
8. Monitor database errors, authentication failures, and row counts closely for at least one hour.
9. Document actual data loss, notify affected users when required, and complete a post-incident review.

## Routine Maintenance

Preview expired authentication data:

```powershell
npm run db:cleanup-auth
```

Apply one bounded cleanup batch:

```powershell
npm run db:cleanup-auth -- --apply
```

Schedule the apply command daily. It removes expired sessions, old revoked sessions, stale rate-limit windows, and expired account-action tokens. It does not remove integration tokens or security-event history. Re-run until every `changed` count is zero if a backlog exceeds the default 5,000-row batch.
