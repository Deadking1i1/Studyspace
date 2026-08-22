import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfHeader } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { SPOTIFY_API_BASE, spotifyRequest, spotifyTokenRecord } from "@/lib/features/spotify";
import { connectedSpotifyTokenError, spotifyErrorResponse, validSpotifyDeviceId } from "@/lib/features/spotify-response";

const repeatStates = new Set(["off", "track", "context"]);

export async function POST(request: NextRequest) {
  try {
    await verifyCsrfHeader(request.headers.get("X-CSRFToken"));
  } catch {
    return NextResponse.json({ error: "Security check failed. Please try again." }, { status: 403 });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const token = await spotifyTokenRecord(user.id);
  if (!token) return connectedSpotifyTokenError();

  const payload = await request.json().catch(() => ({}));
  const action = typeof payload.action === "string" ? payload.action : "";
  const deviceId = validSpotifyDeviceId(payload.device_id);

  try {
    if (action === "previous") {
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/previous`);
      if (deviceId) url.searchParams.set("device_id", deviceId);
      await spotifyRequest("POST", url.toString(), token.accessToken);
    } else if (action === "next") {
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/next`);
      if (deviceId) url.searchParams.set("device_id", deviceId);
      await spotifyRequest("POST", url.toString(), token.accessToken);
    } else if (action === "pause") {
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/pause`);
      if (deviceId) url.searchParams.set("device_id", deviceId);
      await spotifyRequest("PUT", url.toString(), token.accessToken);
    } else if (action === "resume") {
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/play`);
      if (deviceId) url.searchParams.set("device_id", deviceId);
      await spotifyRequest("PUT", url.toString(), token.accessToken);
    } else if (action === "shuffle") {
      const state = Boolean(payload.state);
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/shuffle`);
      url.searchParams.set("state", String(state));
      if (deviceId) url.searchParams.set("device_id", deviceId);
      await spotifyRequest("PUT", url.toString(), token.accessToken);
    } else if (action === "repeat") {
      const state = typeof payload.state === "string" && repeatStates.has(payload.state) ? payload.state : "off";
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/repeat`);
      url.searchParams.set("state", state);
      if (deviceId) url.searchParams.set("device_id", deviceId);
      await spotifyRequest("PUT", url.toString(), token.accessToken);
    } else if (action === "volume") {
      const parsedVolume = Number(payload.volume_percent);
      if (!Number.isFinite(parsedVolume)) return NextResponse.json({ error: "Invalid Spotify volume." }, { status: 400 });
      const volume = Math.min(Math.max(parsedVolume, 0), 100);
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/volume`);
      url.searchParams.set("volume_percent", String(volume));
      if (deviceId) url.searchParams.set("device_id", deviceId);
      await spotifyRequest("PUT", url.toString(), token.accessToken);
    } else if (action === "seek") {
      const parsedPosition = Number(payload.position_ms);
      if (!Number.isFinite(parsedPosition)) return NextResponse.json({ error: "Invalid Spotify track position." }, { status: 400 });
      const position = Math.max(parsedPosition, 0);
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/seek`);
      url.searchParams.set("position_ms", String(Math.floor(position)));
      if (deviceId) url.searchParams.set("device_id", deviceId);
      await spotifyRequest("PUT", url.toString(), token.accessToken);
    } else if (action === "queue") {
      const uri = typeof payload.uri === "string" ? payload.uri : "";
      if (!uri.startsWith("spotify:track:")) return NextResponse.json({ error: "Invalid queue item." }, { status: 400 });
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/queue`);
      url.searchParams.set("uri", uri);
      if (deviceId) url.searchParams.set("device_id", deviceId);
      await spotifyRequest("POST", url.toString(), token.accessToken);
    } else {
      return NextResponse.json({ error: "Unsupported Spotify control." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return spotifyErrorResponse(user.id, error, "Spotify could not apply that control. Premium and an active device may be required.");
  }
}
