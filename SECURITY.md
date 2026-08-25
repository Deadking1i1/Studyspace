# Study Space Security Notes

## Required Production Configuration

The Next/TypeScript application refuses to start in production unless its public URL uses HTTPS, its auth secret is non-default, Resend email delivery is configured, and an authenticated upload-malware scanner is configured.

- Set `NODE_ENV=production`, `STUDY_SPACE_APP_BASE_URL=https://...`, and a unique `AUTH_SECRET` of at least 32 characters.
- Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a verified `EMAIL_FROM` sender.
- Set `UPLOAD_SCANNER_URL` and `UPLOAD_SCANNER_TOKEN`. The endpoint receives the raw file body and must return JSON `{ "safe": true }` only for accepted files.
- Set `TRUST_PROXY_HEADERS=true` only behind a trusted proxy that overwrites `X-Forwarded-For`; otherwise leave it false.
- Use managed PostgreSQL with TLS, automated backups, point-in-time recovery, and least-privilege credentials.
- Use `STORAGE_BACKEND=s3` with a private S3/R2-compatible bucket. Application downloads remain owner-authorized; never expose the bucket publicly.
- Enable `PRIVATE_BETA_ENABLED` with a short `BETA_ALLOWED_EMAILS` allowlist. Keep `NEXT_PUBLIC_STUDY_SPACE_COMMUNITY_ENABLED=false` until moderation safeguards exist.

- Set `FLASK_ENV=production`.
- Set `FLASK_DEBUG=0`.
- Set a unique `SECRET_KEY` with at least 32 characters.
- Set `RATELIMIT_STORAGE_URI` to shared storage such as Redis.
- Keep authentication rate limits conservative in production, especially registration, login, password reset, and email-change flows.
- Set `APP_BASE_URL` to the public HTTPS app URL before sending email links.
- Configure SMTP with `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_USE_TLS`, and `MAIL_DEFAULT_SENDER`.
- Keep future integration secrets such as `OPENAI_API_KEY`, `SPOTIFY_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `STORAGE_ACCESS_KEY_ID`, and `STORAGE_SECRET_ACCESS_KEY` in environment variables only.
- Serve over HTTPS so secure cookies and HSTS can be enabled safely.
- Keep real `.env` files out of source control.

## Account Security

- Passwords are hashed with Werkzeug and are never stored in plaintext.
- Authenticated password changes require the current password, confirmation, and the same strength rules as registration.
- Password reset links use hashed, expiring tokens and a neutral request message to avoid email enumeration.
- New accounts receive an email verification token. Tokens are hashed before storage.
- Email verification and password reset links are sent by SMTP when configured. Development mode flashes links only when SMTP is not configured.
- Email changes require the current password and are not applied until the new address confirms a hashed, expiring token.
- Users can review recent account security events from settings.
- Login and registration clear existing session data before assigning `user_id`.
- Logout is POST-only for session clearing. GET `/logout` redirects without clearing the session.
- Account deletion requires POST, CSRF protection, current password, and typed confirmation.
- Account deletion transfers groups created by the deleted user to another member when possible. Groups with no remaining members are removed.
- Local development may use relaxed account route rate limits for testing; production should keep strict values and Redis-backed shared storage.

## User Data

- User-owned product records must include `user_id` unless there is a clear shared/community reason.
- Account export intentionally excludes `password_hash`.
- Profile privacy defaults are private: email and academic profile details are hidden unless enabled.
- Legacy profile fields on `users` are temporarily synchronized for compatibility during cleanup.

## Audit Events

- Sensitive account actions are written to `security_events`.
- Logged events include registration, login success/failure, logout, email verification/change, settings updates, password changes/resets, data export, and account deletion attempts.
- Security events are system-owned audit records and are preserved when an account is deleted.
- Event metadata must avoid secrets and raw passwords.

## Uploads and Embeds

- Profile image uploads are checked by extension, MIME type, and file signature.
- Upload size is capped by `MAX_CONTENT_LENGTH`.
- Embedded PDF URLs must use HTTPS and match `PDF_ALLOWED_DOMAINS`.
- PDF iframes are sandboxed.
- TypeScript study-material uploads are signature checked and, in production, must pass the configured malware scanner before being written.
- Production objects are written only after scanning. Database-write failures remove the newly stored object, and each beta account has a 250 MB study-material quota.

## Headers and CSP

- Flask-Talisman configures security headers.
- CSP currently allows local scripts/styles/images and approved PDF frame sources.
- Avoid adding inline scripts/styles unless there is a clear reason and CSP is updated deliberately.
- The Next application sets CSP, clickjacking protection, MIME sniffing protection, a restrictive permissions policy, no-referrer behavior, and production HSTS. Inline scripts/styles remain permitted for the current Next/React and component styling model; replacing them with nonce-based CSP is a future hardening step.

## Integrations

- OpenAI, Google OAuth, and cloud storage configuration is present but optional.
- Spotify OAuth and Web Playback SDK support is implemented for browser-session use.
- Spotify playback controls require Spotify Premium.
- The current Spotify implementation stores access tokens server-side in process memory and does not persist refresh tokens. Add encrypted database or managed secret storage and refresh handling before production use.
- Do not enable an integration until its callback routes, scopes, token storage, data retention, user consent, provider terms, and tests are implemented.
- Store OAuth refresh tokens and cloud credentials encrypted or in a managed secret store when those features are added.
- Use least-privilege scopes for Google and Spotify integrations.

## Remaining Risks

- SQLite is suitable for local development, but production should use PostgreSQL with managed backups.
- Email delivery depends on SMTP environment configuration and should be tested with the chosen provider before production launch.
- Production readiness still depends on external operations: alerting, log retention, restore drills, dependency updates, incident response, and penetration testing cannot be supplied by application code alone.
