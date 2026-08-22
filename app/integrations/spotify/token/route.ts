import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { spotifyTokenRecord } from "@/lib/features/spotify";
import { connectedSpotifyTokenError } from "@/lib/features/spotify-response";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const token = await spotifyTokenRecord(user.id);
  if (!token) return connectedSpotifyTokenError();
  return NextResponse.json({
    access_token: token.accessToken,
    expires_at: token.expiresAt ? Math.floor(token.expiresAt.getTime() / 1000) : null,
  }, { headers: { "Cache-Control": "no-store, private", "Referrer-Policy": "same-origin" } });
}
