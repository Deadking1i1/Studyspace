import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSpotifyOAuthState,
  SPOTIFY_SCOPES,
  spotifyFailure,
  spotifyRequest,
  verifySpotifyOAuthState,
} from "@/lib/features/spotify";

describe("Spotify OAuth state protection", () => {
  afterEach(() => vi.useRealTimers());

  it("accepts a fresh state only for the account that initiated OAuth", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T12:00:00Z"));
    const oauth = createSpotifyOAuthState(42);

    expect(verifySpotifyOAuthState(oauth.cookieValue, oauth.state, 42)).toBe(true);
    expect(verifySpotifyOAuthState(oauth.cookieValue, oauth.state, 43)).toBe(false);
    expect(verifySpotifyOAuthState(oauth.cookieValue, "changed", 42)).toBe(false);
  });

  it("rejects an expired OAuth state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T12:00:00Z"));
    const oauth = createSpotifyOAuthState(42);
    vi.setSystemTime(new Date("2026-08-22T12:10:01Z"));

    expect(verifySpotifyOAuthState(oauth.cookieValue, oauth.state, 42)).toBe(false);
  });
});

describe("Spotify request safety", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps scopes limited to the implemented playback and playlist features", () => {
    expect(SPOTIFY_SCOPES).not.toContain("user-read-currently-playing");
    expect(SPOTIFY_SCOPES).not.toContain("user-library-read");
  });

  it("turns a Spotify rate limit into a safe retry instruction", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "sensitive provider detail" } }), {
      status: 429,
      headers: { "Retry-After": "15" },
    })));

    await expect(spotifyRequest("GET", "https://api.spotify.com/v1/me", "access-token")).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 15,
    });
  });

  it("does not expose provider error details to the student", () => {
    const failure = spotifyFailure({ providerPayload: "secret" });

    expect(failure.error).toBe("Spotify could not complete that request.");
    expect(failure.error).not.toContain("secret");
  });
});
