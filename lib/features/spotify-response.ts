import { NextResponse } from "next/server";
import { spotifyFailureForUser } from "@/lib/features/spotify";

export async function spotifyErrorResponse(userId: number, error: unknown, fallback?: string) {
  const failure = await spotifyFailureForUser(userId, error, fallback);
  return NextResponse.json(
    { error: failure.error },
    {
      status: failure.status,
      headers: failure.retryAfterSeconds ? { "Retry-After": String(failure.retryAfterSeconds) } : undefined,
    },
  );
}

export function connectedSpotifyTokenError() {
  return NextResponse.json(
    { error: "Spotify needs to be reconnected before this control can be used." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export function validSpotifyDeviceId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(value) ? value : "";
}
