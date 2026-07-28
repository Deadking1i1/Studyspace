# Study Space TypeScript Stack Migration

Study Space is moving from a Flask/Jinja/SQLAlchemy application to a TypeScript/React/Next/Drizzle application. The migration must preserve the working Flask application until the new stack reaches feature parity.

## Current Stack

- Python
- Flask
- Jinja templates
- Vanilla JavaScript
- SQLAlchemy
- Flask-Migrate/Alembic
- SQLite locally, PostgreSQL-ready configuration

## Target Stack

- TypeScript
- React
- Next.js app router
- Drizzle ORM
- PostgreSQL
- Zod environment validation
- Vitest tests
- Reusable component shell similar to the JVR Workshop app

## Migration Rules

- Do not delete the Flask app until the replacement module is tested.
- Keep current URLs documented and decide whether to preserve or redirect each route.
- PostgreSQL becomes the production database target.
- During the parallel migration, Flask keeps using `DATABASE_URL` while the TypeScript stack uses `STUDY_SPACE_DATABASE_URL` to avoid accidentally pointing Drizzle at the local SQLite file.
- During the parallel migration, Flask keeps using `APP_BASE_URL` while the TypeScript stack uses `STUDY_SPACE_APP_BASE_URL` for redirects.
- Drizzle schema should remain behavior-compatible with the normalized Flask models.
- Security behavior must be ported before public launch: password rules, email verification, password reset, email change, CSRF-equivalent protection, rate limiting, secure cookies, CSP, audit events, export/delete and upload validation.
- Spotify must be rebuilt with encrypted token storage before production use.

## Porting Order

1. App shell, typed environment, database schema and health route.
2. Authentication and sessions.
3. User profile/settings/security events.
4. Notes and tasks.
5. Calendar/events and study sessions.
6. Flashcards.
7. Spotify integration.
8. Groups/feed/community moderation foundation.
9. Account export/delete and legal/privacy surfaces.
10. Final data migration from SQLite/Flask schema to PostgreSQL/Drizzle schema.

## Cutover Criteria

- Full route parity list is complete.
- Drizzle migrations apply to a clean PostgreSQL database.
- Existing Flask test scenarios have TypeScript equivalents.
- Login/register/logout/password reset/email verification pass.
- User-owned data is preserved in migration rehearsal.
- Production security checklist passes.

## Current Commands

- Generate Drizzle migrations: `npm run db:generate`
- Validate Drizzle metadata: `npm run db:check`
- Export the current Flask SQLite data: `npm run data:export-flask`
- Import an exported data snapshot into PostgreSQL: `npm run data:import-postgres`
- Verify the PostgreSQL import against the Flask export: `npm run data:verify-postgres`
- Run TypeScript tests: `npm test`
- Run TypeScript compile check: `npm run typecheck`
- Build the Next app: set a strong `AUTH_SECRET`, then run `npm run build`

`migration-data/` is ignored because it can contain local user account data from the Flask database.

## Current Auth Migration Status

The first TypeScript authentication pass now includes registration, login, logout, password hashing compatible with Werkzeug `scrypt` and `pbkdf2` hashes, session cookies backed by `user_sessions`, protected route proxy checks, double-submit CSRF tokens for form mutations, database-backed auth rate limit counters, email verification token handling, password reset token handling, email-change token handling, account export, account deletion and security event logging.

Email delivery is still development-link based. Before production, wire these token flows to a configured mail provider and test delivery, expiry and abuse/rate-limit behavior against PostgreSQL.

## Local PostgreSQL Rehearsal

This Windows machine now has PostgreSQL 18 installed through winget using the EnterpriseDB installer. The service is `postgresql-x64-18` and listens on `127.0.0.1:5432`.

Local development database:

- Database: `study_space`
- App role: `study_space`
- Local app password: `study_space`
- Superuser used during setup: `postgres`
- Local superuser password used during setup: `study_space_dev_password`

Load the development environment in PowerShell:

```powershell
. .\scripts\dev-postgres-env.ps1
```

Then run:

```powershell
npm run db:migrate
npm run data:export-flask
npm run data:import-postgres
npm run data:verify-postgres
npm run dev -- --hostname 127.0.0.1 --port 3000
```

The PostgreSQL rehearsal on 2026-07-23 applied `drizzle/0000_mighty_monster_badoon.sql`, imported the Flask SQLite export, verified all source table counts, checked foreign keys/unique values/key fields/timestamp nullability/password hash compatibility, and found no issues. A follow-up clean import/verify on 2026-07-28 also passed after the calendar, timer, flashcards, community/feed, notifications, achievements and Spotify migration pass.

## Current Feature Migration Status

The TypeScript stack now has implemented pages/actions for authentication, profile/settings, notes, tasks, calendar/events, study timer sessions, flashcards, notifications, achievements, groups/feed/community and Spotify. Command-level verification passes with `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run db:check`, `npm run data:export-flask`, `npm run data:import-postgres`, `npm run data:verify-postgres`, `npm audit --audit-level=moderate` and the existing Flask unittest suite.

Browser verification remains required for the latest migrated modules because the local environment blocked starting a background Next dev server during the 2026-07-28 pass. Do not mark final parity for those modules until manual/browser checks have exercised their write flows against PostgreSQL.

For Spotify in the TypeScript stack, use one of these redirect URIs in the Spotify developer console:

```text
http://127.0.0.1:3000/integrations/spotify/callback
http://127.0.0.1:3000/api/integrations/spotify/callback
```

Set `SPOTIFY_REDIRECT_URI` to the exact URI selected for the Next app. The old Flask local URI remains `http://127.0.0.1:5000/integrations/spotify/callback`.

If local PostgreSQL is unavailable on another machine, use a Neon development database by setting `STUDY_SPACE_DATABASE_URL` to the Neon pooled or direct PostgreSQL connection string and then running the same Drizzle/data migration commands.
