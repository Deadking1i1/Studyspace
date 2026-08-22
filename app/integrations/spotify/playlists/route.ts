import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { SPOTIFY_API_BASE, spotifyRequest, spotifyTokenRecord } from "@/lib/features/spotify";
import { connectedSpotifyTokenError, spotifyErrorResponse } from "@/lib/features/spotify-response";

type SpotifyPlaylistItem = {
  id: string;
  name: string;
  uri: string;
  tracks?: { total?: number };
  images?: Array<{ url?: string }>;
  owner?: { display_name?: string; id?: string };
};

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const token = await spotifyTokenRecord(user.id);
  if (!token) return connectedSpotifyTokenError();

  try {
    const payload = await spotifyRequest(
      "GET",
      `${SPOTIFY_API_BASE}/me/playlists?limit=50`,
      token.accessToken,
    ) as { items?: SpotifyPlaylistItem[] };
    const playlists = (payload.items || []).map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      uri: playlist.uri,
      trackCount: playlist.tracks?.total ?? 0,
      image: playlist.images?.[0]?.url ?? "",
      owner: playlist.owner?.display_name || playlist.owner?.id || "Spotify",
    }));
    return NextResponse.json({ playlists });
  } catch (error) {
    return spotifyErrorResponse(user.id, error, "Unable to load Spotify playlists.");
  }
}
