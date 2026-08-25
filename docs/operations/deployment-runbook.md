# Deployment Runbook

This runbook is provider-neutral. It assumes an HTTPS ingress or load balancer, a managed PostgreSQL database, private object storage, transactional email, and a malware scanner. The application runs as one stateless Next.js container.

## Release prerequisites

1. Protect the `main` branch and require the `Quality gates / Build, test, and migrate` check.
2. Store production configuration in the deployment platform's encrypted secret store. Do not provide secrets as Docker build arguments.
3. Use a database role that can apply the committed Drizzle migrations. Restrict application runtime privileges separately when the provider supports it.
4. Confirm the database has a recent recoverable backup before migrating.
5. Keep at least one previous immutable application image available for rollback.

## Build

Build the image without production secrets:

```sh
docker build --pull --tag study-space:<git-sha> .
```

The image uses Next.js standalone output, runs as an unprivileged user, and listens on port `3000`. Inject all environment values at container runtime.

## Database migration

Run migrations once as a release task before shifting traffic:

```sh
docker run --rm --env-file /secure/path/study-space.env study-space:<git-sha> npm run db:migrate
```

Do not run schema generation or `db push` in production. Deploy only committed migrations. If migration execution fails, stop the release and inspect the database before retrying.

## Deploy

1. Start the new image with zero user traffic.
2. Wait for the container health check to pass.
3. Request `GET /api/health`; require HTTP 200 and `{ "ok": true }`.
4. Smoke-test the login page and one authenticated read using a beta test account.
5. Shift traffic gradually when the platform supports it; otherwise replace one instance at a time.
6. Watch error rate, latency, database connections, email failures, scanner failures, and storage errors for at least 15 minutes.

The HTTPS proxy must preserve the original host and scheme. Enable trusted forwarded headers only when the proxy overwrites incoming forwarding headers. Terminate TLS with modern protocols and redirect HTTP to HTTPS before requests reach the app.

## Health semantics

`GET /api/health` is a liveness endpoint. It proves the Next.js process can serve requests and intentionally performs no database or third-party calls. Use a separate synthetic authenticated smoke test for end-to-end readiness so a provider outage does not create a health-check restart loop.

Recommended checks:

| Check                              | Frequency           | Failure action                             |
| ---------------------------------- | ------------------- | ------------------------------------------ |
| `/api/health` liveness             | 30 seconds          | Restart unhealthy instance                 |
| HTTPS synthetic login-page request | 1 minute            | Alert after two failures                   |
| Authenticated database-backed read | 5 minutes           | Alert; do not restart every instance       |
| PostgreSQL connection/capacity     | Provider monitoring | Alert at provider-specific safe thresholds |

## Rollback

Application rollback and database rollback are separate decisions.

1. Stop traffic shifting and retain logs/correlation identifiers.
2. If the previous application is compatible with the migrated schema, redeploy the previous immutable image immediately.
3. Do not reverse a migration by editing migration history or manually deleting columns.
4. For an incompatible destructive migration, enter maintenance mode and restore the pre-release backup to a new database. Validate it before changing the application database URL.
5. Re-run health and smoke checks, then record the incident and failed release SHA.

Migrations should be additive and backward compatible across one release whenever practical. Destructive cleanup belongs in a later release after old code is no longer running.

## Post-deployment record

Record the release SHA, image digest, migration journal head, deploy time, operator, backup identifier, smoke-test result, and any rollback decision. Never paste secret values into the record.
