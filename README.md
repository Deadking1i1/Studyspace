# Study Space

A Flask-based study hub with notes, flashcards, groups, and more.

## Run locally

1. Install dependencies:

```bash
python -m pip install -r requirements.txt
```

2. Start locally:

```bash
python app.py
```

3. Apply database migrations when setting up a new database:

```bash
$env:FLASK_APP="app:app"
python -m flask db upgrade
```

4. Open:

```
http://127.0.0.1:5000
```

## Production deployment

This app includes a WSGI entrypoint and `waitress` for production serving.

### Run with Waitress

```bash
waitress-serve --listen=0.0.0.0:8000 wsgi:app
```

### Deploy to Render / Heroku / similar

- Set `web` command to:

```bash
waitress-serve --listen=0.0.0.0:$PORT wsgi:app
```

- Use environment variables:
  - `SECRET_KEY` for Flask secret key (required; production requires at least 32 characters and cannot use the development fallback)
  - `DATABASE_URL` for a custom database file path (optional)
  - `RATELIMIT_STORAGE_URI` for Flask-Limiter storage, for example Redis in production
  - `AUTH_REGISTER_RATE_LIMIT`, `AUTH_LOGIN_RATE_LIMIT`, `AUTH_PASSWORD_RESET_RATE_LIMIT` for account route throttling
  - `PDF_ALLOWED_DOMAINS` as a comma-separated allowlist for embedded PDF URLs
  - `SESSION_COOKIE_SECURE=1` when running behind HTTPS in production
  - `PORT` for the listen port
  - `FLASK_DEBUG=0` for production
  - `FLASK_ENV=development` for local development if you want relaxed session cookie handling
  - `APP_BASE_URL` for absolute email links
  - `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_USE_TLS`, `MAIL_DEFAULT_SENDER` for SMTP email delivery
  - `OPENAI_API_KEY`, `OPENAI_MODEL` for future AI assistant features
  - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` for Spotify OAuth and Web Playback SDK integration
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_OAUTH_SCOPES` for future Google OAuth, Calendar and Drive integration
  - `STORAGE_BACKEND`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT_URL`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_BASE_URL` for future S3/R2-compatible upload storage

> For local development, create a `.env` file from `.env.example` or export `SECRET_KEY` before starting the app.

### Database migrations

Schema changes are managed with Flask-Migrate/Alembic in the `migrations/` folder. Do not add `db.create_all()` to normal app startup.

Useful commands:

```bash
$env:FLASK_APP="app:app"
python -m flask db migrate -m "describe change"
python -m flask db upgrade
python -m flask db current
```

Current migration head:

```text
f7a9b1c3d5e6_email_change_foundation
```

For an existing pre-migration SQLite database, create a backup, stamp the baseline, then upgrade:

```bash
$env:FLASK_APP="app:app"
python -m flask db stamp 0001_initial_schema
python -m flask db upgrade
```

### Local environment example

Create a `.env` file in the project root:

```env
SECRET_KEY=replace-with-a-secure-random-string
DATABASE_URL=database.db
FLASK_DEBUG=1
FLASK_ENV=development
RATELIMIT_STORAGE_URI=memory://
AUTH_REGISTER_RATE_LIMIT=30 per minute
AUTH_LOGIN_RATE_LIMIT=30 per minute
AUTH_PASSWORD_RESET_RATE_LIMIT=20 per minute
PDF_ALLOWED_DOMAINS=
APP_BASE_URL=http://127.0.0.1:5000
MAIL_SERVER=
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_USE_TLS=1
MAIL_DEFAULT_SENDER=

# Future AI assistant integration
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

# Spotify integration. Keep these server-side and out of source control.
# Spotify Dashboard local redirect: http://127.0.0.1:3000/integrations/spotify/callback
# Production callback must be an exact HTTPS URL ending in /integrations/spotify/callback.
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/integrations/spotify/callback

# Future Google OAuth / Calendar / Drive integration
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:5000/integrations/google/callback
GOOGLE_OAUTH_SCOPES=openid,email,profile,https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/drive.file

# Future cloud upload storage. Use STORAGE_BACKEND=local until this is implemented.
STORAGE_BACKEND=local
STORAGE_BUCKET=
STORAGE_REGION=
STORAGE_ENDPOINT_URL=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_BASE_URL=
```

### Future integration configuration

The app already reads optional settings for future OpenAI, Google OAuth and S3/R2-compatible storage integrations. These values are not required for the current local app and should stay blank until the matching feature is implemented.

### Spotify setup

Study Space uses Spotify Authorization Code OAuth at `/spotify`. In the Spotify Developer Dashboard, register exactly one local callback:

```text
http://127.0.0.1:3000/integrations/spotify/callback
```

For production, set `SPOTIFY_REDIRECT_URI` to the exact HTTPS callback for the deployed site. Do not use `localhost`, wildcard redirects, `NEXT_PUBLIC_` Spotify variables, or committed credentials.

The integration requests only the scopes used by the current study music experience:

- `streaming`, `user-read-email`, `user-read-private`: Spotify Web Playback SDK browser player.
- `user-read-playback-state`, `user-modify-playback-state`: device selection and playback controls.
- `playlist-read-private`, `playlist-read-collaborative`: the student's own playlist library.

Tokens are encrypted at rest in PostgreSQL and refresh tokens never leave the server. The short-lived access token endpoint is used only by Spotify's browser SDK for the signed-in owner and is marked `no-store`. Spotify Premium, an available device, and Spotify account/app eligibility may be required for playback.

For troubleshooting, confirm the redirect URI matches character-for-character, reconnect after changing scopes, open Spotify on at least one device, and use the Refresh devices control. Spotify data is not sent to Study Space AI features.

### Security configuration

Production mode is enabled with `FLASK_ENV=production`. In production, the app refuses to start unless:

- `SECRET_KEY` is set to a non-default value of at least 32 characters.
- `RATELIMIT_STORAGE_URI` is not `memory://`.

Authentication rate limits default to stricter production values and friendlier local development values. For local testing, the example uses `AUTH_REGISTER_RATE_LIMIT=30 per minute`. For production, keep conservative values such as `3 per minute` for registration and `5 per minute` for login/password reset unless monitoring proves another threshold is safer.

Recommended production examples:

```env
FLASK_ENV=production
FLASK_DEBUG=0
SECRET_KEY=replace-with-a-long-random-secret-from-a-password-manager
RATELIMIT_STORAGE_URI=redis://localhost:6379/0
PDF_ALLOWED_DOMAINS=example.edu,cdn.example.edu
```

Embedded PDF URLs must use HTTPS and match `PDF_ALLOWED_DOMAINS`. Profile image uploads are checked by extension, MIME type, and file signature.

See `SECURITY.md` for the deployment checklist, account-data rules, and remaining security risks.

Sensitive account actions are recorded in the `security_events` table. This includes registration, login success/failure, logout, settings updates, password changes, data export, and account deletion attempts.

Email verification foundation is present: new accounts receive a hashed verification token, `/verify-email/<token>` marks the email verified, and `/settings/resend-verification` refreshes the token. If SMTP is configured, Study Space sends the link by email; otherwise development mode flashes the verification route so the flow can be tested locally.

Password reset foundation is present: `/forgot-password` prepares a hashed, expiring reset token, `/reset-password/<token>` lets the user set a new strong password, and the request response is neutral to avoid exposing whether an email exists. If SMTP is configured, Study Space sends the reset link by email; otherwise development mode flashes the reset route when a known email requests a reset.

Email change is password-confirmed and token-confirmed. `/settings/change-email` prepares a pending address and `/settings/confirm-email-change/<token>` applies it only after confirmation. `/settings/security-history` shows recent user security events.

### Account profile and settings foundation

User-owned account data is split into:

- `users` for authentication identity and legacy compatibility fields.
- `user_profiles` for display, academic profile and privacy visibility settings.
- `user_settings` for theme, language, timezone, accessibility and notification preferences.

The migration `a2d4e6f8b0c1_user_profile_settings` backfills existing users from the legacy `users.course`, `users.bio` and `users.profile_pic` fields. Those legacy columns are intentionally kept synchronized for now to preserve existing routes and templates during the architecture cleanup.

The migration `c4d6e8f0a1b3_normalize_user_emails` lowercases and trims existing user emails. If existing accounts only differ by casing/spacing, the earliest account keeps the normalized address and later conflicts receive a deterministic `+user{id}` suffix before the email domain so no account is deleted.

Later cleanup migrations add email verification, password reset, and email-change foundations. Run `python -m flask db current` after upgrading to verify the deployed database is at `f7a9b1c3d5e6_email_change_foundation` or a later migration.

### TypeScript migration stack

The new Next/React/Drizzle stack is being built in parallel with Flask. Keep Flask on `DATABASE_URL` and point the TypeScript app at PostgreSQL with `STUDY_SPACE_DATABASE_URL`.

Required Next migration configuration:

- `STUDY_SPACE_DATABASE_URL`: PostgreSQL connection string for Drizzle.
- `STUDY_SPACE_APP_BASE_URL`: Next app base URL, for local development usually `http://127.0.0.1:3000`.
- `AUTH_SECRET`: strong random secret, at least 32 characters. Production builds/runtimes must not use the development placeholder.
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM`: required for production verification, recovery, and email-change messages. Development may use `EMAIL_PROVIDER=console`; development links are never exposed in production.
- `TRUST_PROXY_HEADERS`: leave `false` unless the app is behind a trusted reverse proxy that overwrites forwarded-IP headers.
- `UPLOAD_SCANNER_URL` and `UPLOAD_SCANNER_TOKEN`: required at production runtime. The scanner receives the raw upload and must return `{ "safe": true }` before Study Space stores it.
- `STORAGE_BACKEND=s3` plus `STORAGE_BUCKET`, region/endpoint and credentials: required in production. Local disk remains development-only; objects are private and server-authorized downloads preserve ownership checks.
- `PRIVATE_BETA_ENABLED=true` and `BETA_ALLOWED_EMAILS`: restrict registration to the invited comma-separated email list.
- `NEXT_PUBLIC_STUDY_SPACE_COMMUNITY_ENABLED=false`: keep community, feed and groups gated until reporting, blocking and moderation exist.

Production also requires an HTTPS `STUDY_SPACE_APP_BASE_URL`. Password changes, password resets, and confirmed email changes revoke all existing sessions. Account exports are POST-only and require CSRF plus the current password.

Operational runbooks live in `docs/operations/`; database backup and restore rehearsal is documented in `docs/migration/database-backup-recovery.md`. The `/api/health?probe=live` endpoint is for liveness and `/api/health` checks PostgreSQL readiness.

Before deployment, run:

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
$env:NODE_ENV="production"
npm run security:check-production
```

Use managed PostgreSQL with TLS, automated backups and restore testing. Configure centralized logs, uptime/error alerts, secret rotation and an incident-response contact. Application checks cannot replace those operational controls.

Useful migration commands:

- `npm run db:generate`
- `npm run db:check`
- `npm run data:export-flask`
- `npm run data:import-postgres`
- `npm run typecheck`
- `npm test`
- `npm run build`

The `migration-data/` directory is intentionally ignored because exports may contain real local account data.

The TypeScript auth migration stores sessions in `user_sessions` and rate-limit counters in `auth_rate_limits`. Run Drizzle migrations before attempting login/register flows in the Next app.

Users can download their account data from `/settings/export`. The export is JSON and includes authentication identity, profile/settings, notes, tasks, events, study sessions, flashcards, achievements, notifications and user-owned community records.

Account deletion is available from `/settings` and is intentionally POST-only. It requires the current password and the typed confirmation `DELETE`, then removes dependent user-owned records before deleting the account. Groups created by the deleted user are transferred to another member when possible; groups with no remaining members are removed. Keep this route protected by CSRF in production.

Run this after pulling the cleanup pass:

```bash
$env:FLASK_APP="app:app"
python -m flask db upgrade
```

### Testing

Run all regression tests:

```bash
python -m unittest discover -s tests
```

The suite covers authenticated route smoke checks, registration/login/logout, security helpers, note/task/study-session writes, and normalized profile/settings writes.

### Performance and accessibility notes

List-heavy pages use server-side pagination instead of loading unlimited rows:

- `/notes_hub` and `/notes` show 12 notes per page.
- `/tasks` shows 12 tasks per page while preserving status and priority filters.
- `/notifications` shows 25 notifications per page.
- `/flashcards`, `/groups`, and `/achievements` show 12 records per page.
- `/profile` caps achievement preview data to recent records.

Saved account preferences are applied to the rendered shell:

- `language` sets the page `lang` attribute.
- `theme` and `high_contrast` add body classes for accessible contrast.
- `reduced_motion` disables decorative particles and minimizes CSS motion.

### Notes

If hosting from a local machine, make sure your router/firewall forwards the desired port.
