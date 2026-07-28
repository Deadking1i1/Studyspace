import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { integrationTokens } from "@/db/schema";
import { verifyCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

export const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;

export const SPOTIFY_BASIC_SCOPES = [
  "user-read-email",
  "user-read-private",
] as const;

type StoredSpotifyMetadata = {
  expiresAt?: string;
  displayName?: string;
  spotifyUserId?: string;
};

type SpotifyTokenPayload = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

export function spotifyConfigured() {
  return Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET && env.SPOTIFY_REDIRECT_URI);
}

function encryptionKey() {
  return crypto.createHash("sha256").update(env.AUTH_SECRET).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted payload.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function spotifyAuthHeader() {
  return `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`;
}

export async function spotifyRequest(method: string, url: string, accessToken?: string, data?: unknown) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  if (response.status === 204) return null;
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`Spotify API error ${response.status}: ${text}`);
  }
  return payload;
}

export async function exchangeSpotifyCode(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
  });
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: spotifyAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Spotify token exchange failed ${response.status}: ${JSON.stringify(payload)}`);
  return payload as SpotifyTokenPayload;
}

async function refreshSpotifyToken(userId: number, refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: spotifyAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Spotify refresh failed ${response.status}: ${JSON.stringify(payload)}`);
  await storeSpotifyToken(userId, payload, refreshToken);
  return payload as SpotifyTokenPayload;
}

export async function storeSpotifyToken(userId: number, tokenPayload: SpotifyTokenPayload, existingRefreshToken?: string) {
  const expiresIn = Number(tokenPayload.expires_in || 3600);
  const refreshToken = tokenPayload.refresh_token || existingRefreshToken || "";
  const expiresAt = new Date(Date.now() + Math.max(60, expiresIn - 60) * 1000);
  const values = {
    userId,
    provider: "spotify",
    accessTokenEncrypted: encryptSecret(tokenPayload.access_token),
    refreshTokenEncrypted: refreshToken ? encryptSecret(refreshToken) : null,
    scope: tokenPayload.scope || SPOTIFY_SCOPES.join(" "),
    metadata: { expiresAt: expiresAt.toISOString() } satisfies StoredSpotifyMetadata,
    expiresAt,
    updatedAt: new Date(),
  };
  const [existing] = await db
    .select()
    .from(integrationTokens)
    .where(and(eq(integrationTokens.userId, userId), eq(integrationTokens.provider, "spotify")))
    .limit(1);
  if (existing) {
    await db.update(integrationTokens).set(values).where(eq(integrationTokens.id, existing.id));
  } else {
    await db.insert(integrationTokens).values({ ...values, createdAt: new Date() });
  }
}

export async function spotifyTokenRecord(userId: number) {
  const [record] = await db
    .select()
    .from(integrationTokens)
    .where(and(eq(integrationTokens.userId, userId), eq(integrationTokens.provider, "spotify")))
    .limit(1);
  if (!record) return null;
  const accessToken = decryptSecret(record.accessTokenEncrypted);
  const refreshToken = record.refreshTokenEncrypted ? decryptSecret(record.refreshTokenEncrypted) : "";
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    if (!refreshToken) return null;
    const refreshed = await refreshSpotifyToken(userId, refreshToken);
    return {
      accessToken: refreshed.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + Math.max(60, Number(refreshed.expires_in || 3600) - 60) * 1000),
      scope: refreshed.scope || record.scope || "",
      metadata: (record.metadata ?? {}) as StoredSpotifyMetadata,
    };
  }
  return {
    accessToken,
    refreshToken,
    expiresAt: record.expiresAt,
    scope: record.scope || "",
    metadata: (record.metadata ?? {}) as StoredSpotifyMetadata,
  };
}

export async function spotifyProfile(userId: number) {
  const token = await spotifyTokenRecord(userId);
  if (!token) return null;
  try {
    return await spotifyRequest("GET", `${SPOTIFY_API_BASE}/me`, token.accessToken);
  } catch {
    return null;
  }
}

export async function disconnectSpotifyAction(formData: FormData) {
  "use server";
  try {
    await verifyCsrfToken(formData);
  } catch {
    redirect("/spotify?error=Security%20check%20failed.%20Please%20try%20again.");
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  await db.delete(integrationTokens).where(and(eq(integrationTokens.userId, user.id), eq(integrationTokens.provider, "spotify")));
  revalidatePath("/spotify");
  revalidatePath("/integrations/spotify");
  redirect("/spotify?success=Spotify%20disconnected%20from%20Study%20Space.");
}
