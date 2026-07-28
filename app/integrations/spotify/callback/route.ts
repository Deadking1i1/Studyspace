import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { exchangeSpotifyCode, spotifyProfile, storeSpotifyToken } from "@/lib/features/spotify";

function redirectSpotify(message: string, type: "error" | "success") {
  return NextResponse.redirect(new URL(`/spotify?${type}=${encodeURIComponent(message)}`, env.STUDY_SPACE_APP_BASE_URL));
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", env.STUDY_SPACE_APP_BASE_URL));
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("spotify_oauth_state")?.value || "";
  cookieStore.delete("spotify_oauth_state");

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    const description = request.nextUrl.searchParams.get("error_description");
    return redirectSpotify(
      `Spotify returned ${error}${description ? `: ${description}` : ""}.`,
      "error",
    );
  }
  if (request.nextUrl.searchParams.get("state") !== expectedState) {
    return redirectSpotify("Spotify connection could not be verified. Please try again.", "error");
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return redirectSpotify("Spotify did not return an authorization code.", "error");

  try {
    await storeSpotifyToken(user.id, await exchangeSpotifyCode(code));
    await spotifyProfile(user.id);
    return redirectSpotify("Spotify connected.", "success");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown Spotify error.";
    return redirectSpotify(`Spotify connection failed: ${detail}`, "error");
  }
}
