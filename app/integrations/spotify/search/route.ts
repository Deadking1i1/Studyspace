import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { SPOTIFY_API_BASE, spotifyRequest, spotifyTokenRecord } from "@/lib/features/spotify";

type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  artists?: Array<{ name?: string }>;
  album?: { images?: Array<{ url?: string }> };
};

type SpotifyPlaylist = {
  id: string;
  name: string;
  uri: string;
  images?: Array<{ url?: string }>;
  owner?: { display_name?: string; id?: string };
  tracks?: { total?: number };
};

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const token = await spotifyTokenRecord(user.id);
  if (!token) return NextResponse.json({ error: "Spotify needs to be reconnected." }, { status: 401 });

  const query = (request.nextUrl.searchParams.get("q") || "").trim();
  if (query.length < 2) return NextResponse.json({ tracks: [], playlists: [] });

  const url = new URL(`${SPOTIFY_API_BASE}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track,playlist");
  url.searchParams.set("limit", "8");

  try {
    const payload = await spotifyRequest("GET", url.toString(), token.accessToken) as {
      tracks?: { items?: SpotifyTrack[] };
      playlists?: { items?: Array<SpotifyPlaylist | null> };
    };
    return NextResponse.json({
      tracks: (payload.tracks?.items || []).map((track) => ({
        id: track.id,
        name: track.name,
        uri: track.uri,
        artist: (track.artists || []).map((artist) => artist.name).filter(Boolean).join(", ") || "Spotify",
        image: track.album?.images?.[0]?.url || "",
      })),
      playlists: (payload.playlists?.items || []).filter(Boolean).map((playlist) => ({
        id: playlist!.id,
        name: playlist!.name,
        uri: playlist!.uri,
        owner: playlist!.owner?.display_name || playlist!.owner?.id || "Spotify",
        trackCount: playlist!.tracks?.total ?? 0,
        image: playlist!.images?.[0]?.url || "",
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unable to search Spotify." }, { status: 502 });
  }
}
