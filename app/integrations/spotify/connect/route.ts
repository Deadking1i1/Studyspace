import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { spotifyConfigured, SPOTIFY_AUTHORIZE_URL, SPOTIFY_BASIC_SCOPES, SPOTIFY_SCOPES } from "@/lib/features/spotify";

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", env.STUDY_SPACE_APP_BASE_URL));
  if (!spotifyConfigured()) return NextResponse.redirect(new URL("/spotify?error=Spotify%20is%20not%20configured%20yet.", env.STUDY_SPACE_APP_BASE_URL));

  const mode = request.nextUrl.searchParams.get("mode") || (request.nextUrl.pathname.endsWith("/connect-basic") ? "basic" : "");
  const scopes = mode === "basic" ? SPOTIFY_BASIC_SCOPES : SPOTIFY_SCOPES;
  const state = crypto.randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set("spotify_oauth_state", state, {
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
    scope: scopes.join(" "),
    state,
    show_dialog: "true",
  });
  return NextResponse.redirect(`${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`);
}
