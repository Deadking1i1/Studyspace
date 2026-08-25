const REDACTED = "[REDACTED]";

const SENSITIVE_KEY = /(?:authorization|cookie|password|passwd|secret|token|api[-_]?key|session|credential|private[-_]?key|client[-_]?secret)/i;
const BEARER_VALUE = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const URL_SECRET = /([?&](?:access_token|refresh_token|token|code|key|secret|password)=)[^&#\s]+/gi;

function redactString(value: string) {
  return value.replace(BEARER_VALUE, "$1 [REDACTED]").replace(URL_SECRET, "$1[REDACTED]");
}

export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      ...(value.cause ? { cause: "[REDACTED]" } : {}),
    };
  }
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => redact(entry, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redact(entry, seen),
    ]),
  );
}
