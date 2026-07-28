import { describe, expect, it } from "vitest";
import { validateStudySessionDuration } from "@/lib/features/study-sessions";
import { decryptSecret, encryptSecret, spotifyConfigured } from "@/lib/features/spotify";

describe("feature helpers", () => {
  it("validates study session durations using Flask-compatible limits", () => {
    expect(validateStudySessionDuration("1")).toBe(1);
    expect(validateStudySessionDuration("720")).toBe(720);
    expect(validateStudySessionDuration("0")).toBeNull();
    expect(validateStudySessionDuration("721")).toBeNull();
    expect(validateStudySessionDuration("25.5")).toBeNull();
    expect(validateStudySessionDuration("abc")).toBeNull();
  });

  it("encrypts Spotify secrets without storing plaintext", () => {
    const encrypted = encryptSecret("spotify-access-token");
    expect(encrypted).not.toContain("spotify-access-token");
    expect(decryptSecret(encrypted)).toBe("spotify-access-token");
  });

  it("reports Spotify configuration as a boolean", () => {
    expect(typeof spotifyConfigured()).toBe("boolean");
  });
});
