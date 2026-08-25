# Backup and Recovery Runbook

The managed PostgreSQL and object-storage providers remain the systems of record. Provider-native automated backups, point-in-time recovery, and private object versioning should be enabled where available.

## Recovery targets

- Private beta target RPO: 24 hours or better.
- Private beta target RTO: 4 hours or better.
- Retain daily database backups for at least 14 days.
- Keep object deletion/version retention aligned with the published user-data retention policy.

## Restore rehearsal

Run this rehearsal before private beta and at least quarterly:

1. Create an isolated PostgreSQL database with no production network access from the public internet.
2. Restore the selected provider backup into it.
3. Point a disposable application instance at the restored database.
4. Run `npm run db:migrate` to prove the restored schema can reach the current migration head.
5. Run `npm run db:verify-fresh` only against a newly migrated empty database, not the restored production copy.
6. Verify representative user, note, task, material metadata, session, and academic records.
7. Confirm foreign keys and unique constraints remain valid.
8. Destroy the disposable application and restored database after recording non-sensitive results.

## Database incident recovery

1. Disable writes or place the service in maintenance mode.
2. Determine the incident timestamp and choose the latest clean restore point before it.
3. Restore into a new database rather than overwriting the damaged database.
4. Validate schema head, row-count sanity, critical relationships, and an authenticated workflow.
5. Update the runtime database secret to the restored database and restart instances.
6. Preserve the damaged database for investigation according to the incident-retention policy.

## Object-storage recovery

Restore deleted or corrupted objects using provider version history. Confirm the recovered object key still matches its database metadata and run it through malware scanning again before making it downloadable. Never make the bucket public as a recovery shortcut.

## Evidence to retain

Record backup identifier, restore point, start/end time, achieved RPO/RTO, validation results, failures, and follow-up owner. Exclude credentials, session tokens, file contents, and student personal data.
