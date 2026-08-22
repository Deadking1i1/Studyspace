import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { clearSpotifyConnection, exchangeSpotifyCode, spotifyFailure, spotifyProfile, SPOTIFY_STATE_COOKIE, storeSpotifyToken, verifySpotifyOAuthState } from "@/lib/features/spotify";

function redirectSpotify(message: string, type: "error" | "success") {
  return NextResponse.redirect(new URL(`/spotify?${type}=${encodeURIComponent(message)}`, env.STUDY_SPACE_APP_BASE_URL));
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", env.STUDY_SPACE_APP_BASE_URL));
  const cookieStore = await cookies();
  const storedState = cookieStore.get(SPOTIFY_STATE_COOKIE)?.value;
  cookieStore.delete(SPOTIFY_STATE_COOKIE);

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return redirectSpotify(
      error === "access_denied" ? "Spotify connection was cancelled or denied." : "Spotify could not complete the connection.",
      "error",
    );
  }
  if (!verifySpotifyOAuthState(storedState, request.nextUrl.searchParams.get("state"), user.id)) {
    return redirectSpotify("Spotify connection could not be verified. Please try again.", "error");
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return redirectSpotify("Spotify did not return an authorization code.", "error");

  try {
    await storeSpotifyToken(user.id, await exchangeSpotifyCode(code));
    const profile = await spotifyProfile(user.id);
    if (!profile) {
      await clearSpotifyConnection(user.id);
      return redirectSpotify("Spotify could not verify the connected account. Please try again.", "error");
    }
    return redirectSpotify("Spotify connected.", "success");
  } catch (error) {
    const failure = spotifyFailure(error, "Spotify could not complete the connection.");
    return redirectSpotify(failure.error, "error");
  }
}
