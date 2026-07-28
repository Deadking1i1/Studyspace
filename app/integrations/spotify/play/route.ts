import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfHeader } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { SPOTIFY_API_BASE, spotifyRequest, spotifyTokenRecord } from "@/lib/features/spotify";

export async function POST(request: NextRequest) {
  try {
    await verifyCsrfHeader(request.headers.get("X-CSRFToken"));
  } catch {
    return NextResponse.json({ error: "Security check failed. Please try again." }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const token = await spotifyTokenRecord(user.id);
  if (!token) return NextResponse.json({ error: "Spotify needs to be reconnected." }, { status: 401 });

  const payload = await request.json().catch(() => ({}));
  const contextUri = typeof payload.context_uri === "string" ? payload.context_uri : "";
  const deviceId = typeof payload.device_id === "string" ? payload.device_id : "";
  const uris = Array.isArray(payload.uris) ? payload.uris.filter((uri: unknown) => typeof uri === "string" && uri.startsWith("spotify:track:")).slice(0, 50) : [];
  if (!contextUri.startsWith("spotify:playlist:") && uris.length === 0) {
    return NextResponse.json({ error: "Invalid Spotify item." }, { status: 400 });
  }

  const url = new URL(`${SPOTIFY_API_BASE}/me/player/play`);
  if (deviceId) url.searchParams.set("device_id", deviceId);

  try {
    await spotifyRequest("PUT", url.toString(), token.accessToken, contextUri ? { context_uri: contextUri } : { uris });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to start playback. Spotify Premium and an active device are required." }, { status: 502 });
  }
}
