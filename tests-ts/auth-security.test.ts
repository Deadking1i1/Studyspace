import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { CSRF_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { parseRateLimit } from "@/lib/auth/rate-limit";

describe("auth middleware", () => {
  it("redirects protected pages without a session cookie", () => {
    const response = proxy(new NextRequest("http://127.0.0.1:3000/settings"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("returns 401 for protected account APIs without a session cookie", async () => {
    const response = proxy(new NextRequest("http://127.0.0.1:3000/api/account/export"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
  });

  it("bootstraps CSRF before rendering protected pages with a session cookie", () => {
    const request = new NextRequest("http://127.0.0.1:3000/settings", {
      headers: { cookie: `${SESSION_COOKIE}=opaque-session` },
    });
    const response = proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/settings");
    expect(response.cookies.get(CSRF_COOKIE)?.value).toBeTruthy();
  });

  it("allows protected paths to reach server-side session validation when session and csrf cookies exist", () => {
    const request = new NextRequest("http://127.0.0.1:3000/settings", {
      headers: { cookie: `${SESSION_COOKIE}=opaque-session; ${CSRF_COOKIE}=csrf-token` },
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
  });
});

describe("auth rate limit parsing", () => {
  it("parses Flask-style rate limit strings", () => {
    expect(parseRateLimit("3 per minute", 9, 9)).toEqual({ limit: 3, windowSeconds: 60 });
    expect(parseRateLimit("5 per 2 hour", 9, 9)).toEqual({ limit: 5, windowSeconds: 7200 });
    expect(parseRateLimit("bad", 9, 9)).toEqual({ limit: 9, windowSeconds: 9 });
  });
});
