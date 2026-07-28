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
  const deviceId = typeof payload.device_id === "string" ? payload.device_id : "";
  if (!deviceId) return NextResponse.json({ error: "Missing Spotify device ID." }, { status: 400 });
  try {
    await spotifyRequest("PUT", `${SPOTIFY_API_BASE}/me/player`, token.accessToken, { device_ids: [deviceId], play: false });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to transfer Spotify playback. Premium may be required." }, { status: 502 });
  }
}
