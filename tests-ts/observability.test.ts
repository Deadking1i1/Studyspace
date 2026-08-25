import { describe, expect, it, vi } from "vitest";
import { healthResponse } from "@/lib/observability/health-response";
import { createLogEntry } from "@/lib/observability/logger";
import {
  correlationIdFrom,
  withRequestContext,
} from "@/lib/observability/request-context";
import { redact } from "@/lib/observability/redaction";

describe("observability", () => {
  it("redacts sensitive keys and credentials recursively", () => {
    expect(
      redact({
        password: "hidden",
        nested: { accessToken: "token", note: "Bearer abc.def" },
      }),
    ).toEqual({
      password: "[REDACTED]",
      nested: { accessToken: "[REDACTED]", note: "Bearer [REDACTED]" },
    });
  });

  it("adds the active correlation ID to structured entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T12:00:00Z"));
    const entry = withRequestContext("request-1234", () =>
      createLogEntry("info", "test.event", { ok: true }),
    );
    expect(entry).toMatchObject({
      correlationId: "request-1234",
      event: "test.event",
      level: "info",
      ok: true,
    });
    vi.useRealTimers();
  });

  it("does not allow caller fields to overwrite canonical log metadata", () => {
    const entry = withRequestContext("request-1234", () =>
      createLogEntry("warn", "real.event", {
        level: "info",
        event: "spoofed.event",
        service: "other-service",
        correlationId: "spoofed-request",
      }),
    );
    expect(entry).toMatchObject({
      level: "warn",
      event: "real.event",
      service: "study-space",
      correlationId: "request-1234",
    });
  });

  it("rejects unsafe caller-supplied request IDs", () => {
    const request = new Request("https://example.test", {
      headers: { "x-request-id": "bad id value" },
    });
    expect(correlationIdFrom(request)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns a minimal liveness response without calling dependencies", async () => {
    const check = vi.fn();
    const response = await healthResponse(
      new Request("https://example.test/api/health?probe=live"),
      check,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(check).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 with coarse dependency status when not ready", async () => {
    const response = await healthResponse(
      new Request("https://example.test/api/health", {
        headers: { "x-request-id": "request-5678" },
      }),
      async () => ({ ready: false, checks: { database: "down" } }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unavailable",
      checks: { database: "down" },
    });
    expect(response.headers.get("x-request-id")).toBe("request-5678");
  });

  it("returns a stable 503 when the readiness checker throws", async () => {
    const response = await healthResponse(
      new Request("https://example.test/api/health"),
      async () => {
        throw new Error("database URL contained a secret");
      },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unavailable",
      checks: { database: "down" },
    });
  });
});
