# PostgreSQL Rehearsal - 2026-07-23

## Setup Used

- PostgreSQL 18 installed via winget / EnterpriseDB installer.
- Windows service: `postgresql-x64-18`.
- Host: `127.0.0.1`.
- Port: `5432`.
- Database: `study_space`.
- App role: `study_space`.

Development environment:

```powershell
STUDY_SPACE_DATABASE_URL=postgresql://study_space:study_space@127.0.0.1:5432/study_space
AUTH_SECRET=replace-with-a-local-development-secret-at-least-32-characters
STUDY_SPACE_APP_BASE_URL=http://127.0.0.1:3000
```

## Migration Applied

- `drizzle/0000_mighty_monster_badoon.sql`

Drizzle migration history contains one initial SQL file plus its metadata snapshot/journal.

## Data Migration Result

Commands run:

```powershell
npm run data:export-flask
npm run data:import-postgres
npm run data:verify-postgres
```

Verification result: passed with no issues.

## Row Counts

| Table | Flask export | PostgreSQL |
| --- | ---: | ---: |
| users | 2 | 2 |
| user_profiles | 2 | 2 |
| user_settings | 2 | 2 |
| security_events | 21 | 21 |
| events | 1 | 1 |
| notes | 0 | 0 |
| flashcards | 0 | 0 |
| flashcard_cards | 0 | 0 |
| study_sessions | 0 | 0 |
| groups | 0 | 0 |
| group_members | 0 | 0 |
| posts | 0 | 0 |
| comments | 0 | 0 |
| likes | 0 | 0 |
| notifications | 0 | 0 |
| achievements | 0 | 0 |
| tasks | 0 | 0 |

Operational tables after clean import:

| Table | Rows |
| --- | ---: |
| auth_rate_limits | 0 |
| user_sessions | 0 |
| integration_tokens | 0 |

Password hash compatibility: 2 checked, 2 supported, 0 unsupported.

## Browser Parity Verified

- Registration with PostgreSQL writes.
- Duplicate registration rejection.
- Login and session persistence.
- Disposable migrated Flask/Werkzeug-hash user login.
- Logout.
- Protected route redirects.
- Invalid session redirect.
- CSRF rejection on logout API without token.
- Auth rate limiting through browser login form.
- Email verification using development link.
- Password reset using development link.
- Email change using development link and password confirmation.
- Account export download.
- Account deletion with failed password check and successful deletion.
- Profile/settings editing.
- Notes create/read/update/summarize/archive/restore/delete.
- Tasks create/complete/reopen/archive/restore/delete.

## Fixes Made During Rehearsal

- Moved CSRF cookie issuance out of Server Components and into `proxy.ts`.
- Added dashboard rendering of `success` / `error` query notices so development token links are visible after auth redirects.
- Added real note edit/update support before marking notes CRUD verified.
- Added PostgreSQL migration verifier script.

## Remaining Blockers

- SMTP/email provider delivery is still not wired; token flows are verified with development links only.
- Actual imported user login cannot be browser-tested without that user's plaintext password; compatibility was verified from imported hash formats and with a disposable Werkzeug-hash user.
- Profile image upload parity remains pending in the React stack.

## Follow-Up Rehearsal - 2026-07-28

After migrating calendar/events, timer sessions, flashcards, notifications, achievements, groups/feed/community and Spotify integration routes into the TypeScript stack, the clean SQLite export and PostgreSQL import were rerun.

Commands passed:

```powershell
npm run data:export-flask
npm run data:import-postgres
npm run data:verify-postgres
```

Verification result: passed with no issues.

Updated row counts:

| Table | Flask export | PostgreSQL |
| --- | ---: | ---: |
| users | 2 | 2 |
| user_profiles | 2 | 2 |
| user_settings | 2 | 2 |
| security_events | 24 | 24 |
| events | 1 | 1 |
| notes | 0 | 0 |
| flashcards | 0 | 0 |
| flashcard_cards | 0 | 0 |
| study_sessions | 0 | 0 |
| groups | 0 | 0 |
| group_members | 0 | 0 |
| posts | 0 | 0 |
| comments | 0 | 0 |
| likes | 0 | 0 |
| notifications | 0 | 0 |
| achievements | 0 | 0 |
| tasks | 0 | 0 |

Operational tables after clean import:

| Table | Rows |
| --- | ---: |
| auth_rate_limits | 0 |
| user_sessions | 0 |
| integration_tokens | 0 |

Password hash compatibility: 2 checked, 2 supported, 0 unsupported.
