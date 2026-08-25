import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExternalServiceError,
  safeExternalError,
} from "@/lib/resilience/external-service";
import { fetchWithTimeout, withTimeout } from "@/lib/resilience/timeout";

describe("resilience helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("bounds an operation and exposes no underlying error details", async () => {
    vi.useFakeTimers();
    const operation = withTimeout(
      new Promise<never>(() => undefined),
      5,
      "database",
    );
    const assertion =
      expect(operation).rejects.toBeInstanceOf(ExternalServiceError);
    await vi.advanceTimersByTimeAsync(5);
    await assertion;
    expect(safeExternalError(new Error("credential leaked"))).toEqual({
      error: "The external service could not complete the request.",
      retryable: true,
    });
  });

  it("converts fetch failures into a provider-neutral error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new Error("https://secret-host.invalid?token=secret"),
        ),
    );
    await expect(
      fetchWithTimeout("calendar", "https://example.test", {}, 100),
    ).rejects.toMatchObject({
      name: "ExternalServiceError",
      service: "calendar",
      retryable: true,
    });
  });

  it("honors a parent signal that was aborted before the request starts", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.signal?.aborted).toBe(true);
        throw init?.signal?.reason ?? new DOMException("Aborted", "AbortError");
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const parent = new AbortController();
    parent.abort(new DOMException("Cancelled", "AbortError"));

    await expect(
      fetchWithTimeout(
        "calendar",
        "https://example.test",
        { signal: parent.signal },
        100,
      ),
    ).rejects.toMatchObject({
      name: "ExternalServiceError",
      service: "calendar",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
