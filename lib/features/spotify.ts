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
export const SPOTIFY_STATE_COOKIE = "spotify_oauth_state";

// Every scope below maps to an existing Study Space control. Keep this list narrow.
export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;

export type SpotifyConnectionState = "connected" | "disconnected" | "reauthorization_required" | "temporarily_unavailable";

type StoredSpotifyMetadata = {
  connectionState?: SpotifyConnectionState;
  displayName?: string;
  expiresAt?: string;
  lastRefreshAttemptAt?: string;
  lastSuccessfulConnectionAt?: string;
  spotifyUserId?: string;
};

export type SpotifyProfile = {
  id?: string;
  display_name?: string;
  product?: string;
};

type SpotifyTokenPayload = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type SpotifyOAuthState = {
  state: string;
  userId: number;
  createdAt: number;
};

export class SpotifyApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

function asMetadata(value: unknown): StoredSpotifyMetadata {
  return value && typeof value === "object" && !Array.isArray(value) ? value as StoredSpotifyMetadata : {};
}

function encryptionKey() {
  return crypto.createHash("sha256").update(env.AUTH_SECRET).digest();
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
}

function retryAfterSeconds(value: string | null) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.ceil(seconds), 120) : undefined;
}

function spotifyMessageForStatus(status: number, retryAfter?: number) {
  if (status === 401) return "Spotify authorization has expired. Reconnect Spotify to continue.";
  if (status === 403) return "Spotify did not allow that action. Spotify Premium, an active device, or an additional permission may be required.";
  if (status === 404) return "Spotify could not find the requested player or item.";
  if (status === 429) return `Spotify is busy. Try again${retryAfter ? ` in about ${retryAfter} seconds` : " shortly"}.`;
  if (status >= 500) return "Spotify is temporarily unavailable. Try again shortly.";
  return "Spotify could not complete that request.";
}

export function spotifyFailure(error: unknown, fallback = "Spotify could not complete that request.") {
  if (error instanceof SpotifyApiError) {
    return {
      error: spotifyMessageForStatus(error.status, error.retryAfterSeconds),
      retryAfterSeconds: error.retryAfterSeconds,
      status: error.status === 429 ? 429 : error.status >= 400 && error.status < 600 ? error.status : 502,
    };
  }
  return { error: fallback, retryAfterSeconds: undefined, status: 502 };
}

export function spotifyRedirectUriIsValid() {
  try {
    const redirectUri = new URL(env.SPOTIFY_REDIRECT_URI);
    if (redirectUri.pathname !== "/integrations/spotify/callback") return false;
    if (env.NODE_ENV === "production") return redirectUri.protocol === "https:";
    return redirectUri.protocol === "http:" && redirectUri.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function spotifyConfigured() {
  return Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET && spotifyRedirectUriIsValid());
}

export function spotifyConfigurationMessage() {
  return "Spotify needs a server-side client ID, client secret, and an exact callback URL before it can be connected.";
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

export function createSpotifyOAuthState(userId: number) {
  const oauthState: SpotifyOAuthState = {
    state: crypto.randomBytes(32).toString("base64url"),
    userId,
    createdAt: Date.now(),
  };
  return {
    cookieValue: Buffer.from(JSON.stringify(oauthState)).toString("base64url"),
    state: oauthState.state,
  };
}

export function verifySpotifyOAuthState(cookieValue: string | undefined, returnedState: string | null, userId: number) {
  if (!cookieValue || !returnedState) return false;
  try {
    const parsed = JSON.parse(Buffer.from(cookieValue, "base64url").toString("utf8")) as Partial<SpotifyOAuthState>;
    return (
      typeof parsed.state === "string"
      && typeof parsed.userId === "number"
      && typeof parsed.createdAt === "number"
      && parsed.userId === userId
      && Date.now() - parsed.createdAt >= 0
      && Date.now() - parsed.createdAt <= 10 * 60 * 1000
      && safeEqual(parsed.state, returnedState)
    );
  } catch {
    return false;
  }
}

export async function spotifyRequest(method: string, url: string, accessToken?: string, data?: unknown) {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new SpotifyApiError(503, "Network request failed.");
  }

  if (response.status === 204) return null;
  const body = await response.text();
  if (!response.ok) {
    throw new SpotifyApiError(response.status, "Spotify request failed.", retryAfterSeconds(response.headers.get("retry-after")));
  }
  if (!body) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new SpotifyApiError(502, "Spotify returned an invalid response.");
  }
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
  }).catch(() => null);
  if (!response) throw new SpotifyApiError(503, "Token exchange network failure.");
  const payload = await response.json().catch(() => null) as SpotifyTokenPayload | null;
  if (!response.ok || !payload?.access_token) throw new SpotifyApiError(response.status, "Token exchange failed.", retryAfterSeconds(response.headers.get("retry-after")));
  return payload;
}

async function markSpotifyConnectionState(userId: number, connectionState: SpotifyConnectionState) {
  const [record] = await db
    .select()
    .from(integrationTokens)
    .where(and(eq(integrationTokens.userId, userId), eq(integrationTokens.provider, "spotify")))
    .limit(1);
  if (!record) return;
  const metadata = asMetadata(record.metadata);
  await db
    .update(integrationTokens)
    .set({
      metadata: { ...metadata, connectionState, lastRefreshAttemptAt: new Date().toISOString() },
      updatedAt: new Date(),
    })
    .where(eq(integrationTokens.id, record.id));
}

async function refreshSpotifyToken(userId: number, refreshToken: string) {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: spotifyAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  }).catch(() => null);
  if (!response) throw new SpotifyApiError(503, "Token refresh network failure.");
  const payload = await response.json().catch(() => null) as SpotifyTokenPayload | null;
  if (!response.ok || !payload?.access_token) throw new SpotifyApiError(response.status, "Token refresh failed.", retryAfterSeconds(response.headers.get("retry-after")));
  await storeSpotifyToken(userId, payload, refreshToken);
  return payload;
}

export async function storeSpotifyToken(userId: number, tokenPayload: SpotifyTokenPayload, existingRefreshToken?: string) {
  const [existing] = await db
    .select()
    .from(integrationTokens)
    .where(and(eq(integrationTokens.userId, userId), eq(integrationTokens.provider, "spotify")))
    .limit(1);
  const expiresIn = Number(tokenPayload.expires_in || 3600);
  const refreshToken = tokenPayload.refresh_token || existingRefreshToken || "";
  const expiresAt = new Date(Date.now() + Math.max(60, expiresIn - 60) * 1000);
  const metadata = asMetadata(existing?.metadata);
  const values = {
    userId,
    provider: "spotify",
    accessTokenEncrypted: encryptSecret(tokenPayload.access_token),
    refreshTokenEncrypted: refreshToken ? encryptSecret(refreshToken) : null,
    scope: tokenPayload.scope || existing?.scope || SPOTIFY_SCOPES.join(" "),
    metadata: {
      ...metadata,
      connectionState: "connected" as const,
      expiresAt: expiresAt.toISOString(),
      lastRefreshAttemptAt: new Date().toISOString(),
      lastSuccessfulConnectionAt: metadata.lastSuccessfulConnectionAt || new Date().toISOString(),
    },
    expiresAt,
    updatedAt: new Date(),
  };
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

  try {
    const accessToken = decryptSecret(record.accessTokenEncrypted);
    const refreshToken = record.refreshTokenEncrypted ? decryptSecret(record.refreshTokenEncrypted) : "";
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      if (!refreshToken) {
        await markSpotifyConnectionState(userId, "reauthorization_required");
        return null;
      }
      try {
        const refreshed = await refreshSpotifyToken(userId, refreshToken);
        return {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token || refreshToken,
          expiresAt: new Date(Date.now() + Math.max(60, Number(refreshed.expires_in || 3600) - 60) * 1000),
          scope: refreshed.scope || record.scope || "",
          metadata: asMetadata(record.metadata),
        };
      } catch (error) {
        await markSpotifyConnectionState(userId, error instanceof SpotifyApiError && error.status >= 500 ? "temporarily_unavailable" : "reauthorization_required");
        return null;
      }
    }
    return { accessToken, refreshToken, expiresAt: record.expiresAt, scope: record.scope || "", metadata: asMetadata(record.metadata) };
  } catch {
    await markSpotifyConnectionState(userId, "reauthorization_required");
    return null;
  }
}

export async function spotifyConnectionStatus(userId: number): Promise<SpotifyConnectionState> {
  const [record] = await db
    .select()
    .from(integrationTokens)
    .where(and(eq(integrationTokens.userId, userId), eq(integrationTokens.provider, "spotify")))
    .limit(1);
  if (!record) return "disconnected";
  const token = await spotifyTokenRecord(userId);
  if (token) return "connected";
  return asMetadata(record.metadata).connectionState || "reauthorization_required";
}

export async function spotifyProfile(userId: number): Promise<SpotifyProfile | null> {
  const token = await spotifyTokenRecord(userId);
  if (!token) return null;
  try {
    const profile = await spotifyRequest("GET", `${SPOTIFY_API_BASE}/me`, token.accessToken) as SpotifyProfile;
    if (!profile?.id) return null;
    const [record] = await db
      .select()
      .from(integrationTokens)
      .where(and(eq(integrationTokens.userId, userId), eq(integrationTokens.provider, "spotify")))
      .limit(1);
    if (record) {
      await db.update(integrationTokens).set({
        metadata: { ...asMetadata(record.metadata), spotifyUserId: profile.id, displayName: profile.display_name, connectionState: "connected" },
        updatedAt: new Date(),
      }).where(eq(integrationTokens.id, record.id));
    }
    return profile;
  } catch (error) {
    if (error instanceof SpotifyApiError && error.status === 401) await markSpotifyConnectionState(userId, "reauthorization_required");
    return null;
  }
}

export async function spotifyFailureForUser(userId: number, error: unknown, fallback?: string) {
  if (error instanceof SpotifyApiError && error.status === 401) await markSpotifyConnectionState(userId, "reauthorization_required");
  return spotifyFailure(error, fallback);
}

export async function clearSpotifyConnection(userId: number) {
  await db.delete(integrationTokens).where(and(eq(integrationTokens.userId, userId), eq(integrationTokens.provider, "spotify")));
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
  await clearSpotifyConnection(user.id);
  revalidatePath("/spotify");
  revalidatePath("/integrations/spotify");
  redirect("/spotify?success=Spotify%20disconnected%20from%20Study%20Space.");
}
