import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { SpotifyPlayerShell } from "@/components/spotify/spotify-player";
import { getCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { disconnectSpotifyAction, spotifyConfigured, spotifyProfile, spotifyTokenRecord, SPOTIFY_SCOPES } from "@/lib/features/spotify";

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
  const token = configured ? await spotifyTokenRecord(user.id) : null;
  const profile = token ? await spotifyProfile(user.id) : null;

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Integration</p>
          <h1>Spotify</h1>
          <p className="muted">Connect Spotify Premium playback and control focus music inside Study Space.</p>
        </div>
        {token ? (
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
          <h2>{token ? "Connected" : "Connection"}</h2>
          {!configured ? (
            <p className="notice error">Spotify is not configured yet. Add Spotify credentials to the environment first.</p>
          ) : !token ? (
            <div className="grid">
              <p className="muted">Connect your Spotify account to enable browser playback controls.</p>
              <a className="button" href="/integrations/spotify/connect">Connect Spotify</a>
              <a className="button secondary" href="/integrations/spotify/connect?mode=basic">Test basic Spotify login</a>
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
        </aside>
      </section>
    </AppShell>
  );
}
