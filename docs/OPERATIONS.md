# Study Space Operations

## Health probes

- `GET /api/health?probe=live` is the liveness probe. It only confirms that the Next.js process can answer requests.
- `GET /api/health` is the readiness probe. It returns HTTP `200` only when required dependencies are available, otherwise `503`.
- Both responses disable caching and return `X-Request-Id`. Dependency results are deliberately coarse and never include hosts, credentials, exceptions, or SQL details.

Use liveness to restart a stuck process. Use readiness to remove an instance from traffic. Do not restart an otherwise healthy process merely because PostgreSQL is temporarily unavailable.

## Structured logs

Application logs are newline-delimited JSON with a timestamp, severity, event name, service name, correlation ID when available, and event fields. Collect stdout/stderr in the hosting platform and retain production logs according to the privacy policy.

Known secret-bearing keys and bearer/basic credentials are recursively redacted. Redaction is defense in depth: code must still avoid logging request bodies, cookies, authorization headers, reset links, raw provider responses, personal study content, or environment variables.

Forward `X-Request-Id` from a trusted edge proxy, or allow Study Space to generate one. Include the returned request ID in support and incident reports.

## External dependencies

Use the shared bounded timeout helpers for new outbound HTTP and dependency operations. Return generic errors to students, log only safe operational context, and treat retries carefully: retrying non-idempotent requests can duplicate writes.

Recommended alerts:

- readiness failures lasting more than two minutes;
- sustained HTTP 5xx responses;
- elevated authentication failures or rate limiting;
- email, storage, malware-scanner, or Spotify error rates;
- PostgreSQL connection exhaustion, latency, storage, and backup failures.

Provider dashboards, backup restoration drills, alert destinations, on-call ownership, and incident escalation must be configured before public launch.
