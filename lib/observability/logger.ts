import { currentCorrelationId } from "./request-context";
import { redact } from "./redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

type LogSink = (line: string) => void;

const sinks: Record<LogLevel, LogSink> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

export function createLogEntry(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
) {
  const correlationId = currentCorrelationId();
  return redact({
    ...fields,
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "study-space",
    ...(correlationId ? { correlationId } : {}),
  });
}

export function log(level: LogLevel, event: string, fields: LogFields = {}) {
  sinks[level](JSON.stringify(createLogEntry(level, event, fields)));
}

export const logger = {
  debug: (event: string, fields?: LogFields) => log("debug", event, fields),
  info: (event: string, fields?: LogFields) => log("info", event, fields),
  warn: (event: string, fields?: LogFields) => log("warn", event, fields),
  error: (event: string, fields?: LogFields) => log("error", event, fields),
};
