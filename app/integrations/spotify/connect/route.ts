import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { createSpotifyOAuthState, spotifyConfigured, SPOTIFY_AUTHORIZE_URL, SPOTIFY_SCOPES, SPOTIFY_STATE_COOKIE } from "@/lib/features/spotify";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", env.STUDY_SPACE_APP_BASE_URL));
  if (!spotifyConfigured()) return NextResponse.redirect(new URL("/spotify?error=Spotify%20is%20not%20configured%20yet.", env.STUDY_SPACE_APP_BASE_URL));

  const { cookieValue, state } = createSpotifyOAuthState(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SPOTIFY_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  const params = new URLSearchParams({
    client_id: env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES.join(" "),
    state,
    show_dialog: "true",
  });
  return NextResponse.redirect(`${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`);
}
