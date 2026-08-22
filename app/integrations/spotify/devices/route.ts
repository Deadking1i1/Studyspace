import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { SPOTIFY_API_BASE, spotifyRequest, spotifyTokenRecord } from "@/lib/features/spotify";
import { connectedSpotifyTokenError, spotifyErrorResponse } from "@/lib/features/spotify-response";

type SpotifyDevice = {
  id?: string | null;
  is_active?: boolean;
  is_private_session?: boolean;
  name?: string;
  type?: string;
  volume_percent?: number | null;
};

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const token = await spotifyTokenRecord(user.id);
  if (!token) return connectedSpotifyTokenError();

  try {
    const payload = await spotifyRequest("GET", `${SPOTIFY_API_BASE}/me/player/devices`, token.accessToken) as { devices?: SpotifyDevice[] };
    return NextResponse.json({
      devices: (payload.devices || [])
        .filter((device) => device.id)
        .map((device) => ({
          id: device.id,
          active: Boolean(device.is_active),
          name: device.name || "Spotify device",
          privateSession: Boolean(device.is_private_session),
          type: device.type || "Unknown device",
          volumePercent: device.volume_percent ?? null,
        })),
    }, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch (error) {
    return spotifyErrorResponse(user.id, error, "Unable to load Spotify devices.");
  }
}
