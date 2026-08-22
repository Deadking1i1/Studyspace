import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { SpotifyPlayerShell } from "@/components/spotify/spotify-player";
import { getCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { disconnectSpotifyAction, spotifyConfigurationMessage, spotifyConfigured, spotifyConnectionStatus, spotifyProfile, spotifyTokenRecord, SPOTIFY_SCOPES } from "@/lib/features/spotify";

export default async function SpotifyPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();
  const configured = spotifyConfigured();
  const connectionState = configured ? await spotifyConnectionStatus(user.id) : "disconnected";
  const token = connectionState === "connected" ? await spotifyTokenRecord(user.id) : null;
  const profile = token ? await spotifyProfile(user.id) : null;
  const connected = Boolean(token && profile);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Integration</p>
          <h1>Spotify</h1>
          <p className="muted">Connect Spotify Premium playback and control focus music inside Study Space.</p>
        </div>
        {connected ? (
          <form action={disconnectSpotifyAction}>
            <input name="csrf_token" type="hidden" value={csrfToken} />
            <button className="button secondary" type="submit">Disconnect</button>
          </form>
        ) : null}
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="workspace-grid">
        <article className="card">
          <h2>{connected ? "Connected" : "Connection"}</h2>
          {!configured ? (
            <p className="notice error">{spotifyConfigurationMessage()}</p>
          ) : connectionState === "reauthorization_required" ? (
            <div className="grid">
              <p className="notice error">Spotify needs permission again before playback can continue.</p>
              <a className="button" href="/integrations/spotify/connect">Reconnect Spotify</a>
            </div>
          ) : connectionState === "temporarily_unavailable" ? (
            <div className="grid">
              <p className="notice error">Spotify is temporarily unavailable. Your focus timer will continue normally.</p>
              <a className="button secondary" href="/spotify">Check connection again</a>
            </div>
          ) : !connected ? (
            <div className="grid">
              <p className="muted">Connect your Spotify account to enable browser playback controls.</p>
              <a className="button" href="/integrations/spotify/connect">Connect Spotify</a>
            </div>
          ) : (
            <div className="grid">
              <p className="notice success">Connected{profile ? `: ${profile.display_name || profile.id}` : ""}</p>
              <SpotifyPlayerShell csrfToken={csrfToken} />
            </div>
          )}
        </article>

        <aside className="card">
          <h2>Access used</h2>
          <p className="muted">Study Space requests only the Spotify permissions needed for profile lookup, playlists, and playback control.</p>
          <ul className="feature-list">
            {SPOTIFY_SCOPES.map((scope) => <li key={scope}>{scope}</li>)}
          </ul>
          <p className="muted">Playback is provided by Spotify. Study Space does not use Spotify data for AI features.</p>
        </aside>
      </section>
    </AppShell>
  );
}
