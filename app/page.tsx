import { AppShell } from "@/components/shell/app-shell";

const migrationModules = [
  ["Authentication", "Port Flask register/login/session/security flows"],
  ["Notes", "Move notes hub, rich editor, archive, pin and summary flows"],
  ["Planner", "Move tasks, priorities, due dates and reminders"],
  ["Calendar", "Move events and prepare Google sync boundaries"],
  ["Flashcards", "Move decks/cards and public sharing"],
  ["Community", "Move groups, feed, comments, likes and moderation hooks"],
  ["Spotify", "Rebuild OAuth and Web Playback SDK with encrypted token storage"],
  ["Settings", "Move profile, preferences, export/delete and security history"],
];

export default async function DashboardPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Migration foundation</p>
          <h1>Study Space TypeScript Stack</h1>
          <p className="muted">
            This is the new React/Next/Drizzle foundation that will replace the Flask stack once each
            module reaches feature parity.
          </p>
        </div>
        <a className="button" href="/login">
          Preview login
        </a>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="grid stats-grid">
        <article className="card stat">
          <p className="muted">Current stack</p>
          <strong>Flask</strong>
        </article>
        <article className="card stat">
          <p className="muted">Target stack</p>
          <strong>TypeScript</strong>
        </article>
        <article className="card stat">
          <p className="muted">Database target</p>
          <strong>Postgres</strong>
        </article>
        <article className="card stat">
          <p className="muted">Migration mode</p>
          <strong>Parallel</strong>
        </article>
      </section>

      <section className="grid workspace-grid" style={{ marginTop: 18 }}>
        <article className="card">
          <h2>Feature Parity Roadmap</h2>
          <p className="muted">
            The Flask app remains the source of truth until these modules are ported, tested and
            checked against existing behavior.
          </p>
          <ul className="feature-list">
            {migrationModules.map(([name, detail]) => (
              <li key={name}>
                <span>
                  <strong>{name}</strong>
                  <br />
                  <span className="muted">{detail}</span>
                </span>
                <span className="status-pill">Queued</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Why this stack</h2>
          <p className="muted">
            Study Space is becoming an app, not a set of server templates. TypeScript, React, Next and
            Drizzle give us typed database access, reusable UI, stronger frontend architecture and a
            cleaner path to realtime student workflows.
          </p>
          <div className="grid">
            <a className="button secondary" href="/login">
              Login shell
            </a>
            <a className="button secondary" href="/api/health">
              Health API
            </a>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
