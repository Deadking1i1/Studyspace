import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { StudyTimer } from "@/components/timer/study-timer";
import { db } from "@/db";
import { studySessions } from "@/db/schema";
import { getCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { getAcademicOptions } from "@/lib/features/academic";
import { getStudySessionStats, recentStudySessionPredicate, saveStudySessionAction, studySessionOrder } from "@/lib/features/study-sessions";

export default async function TimerPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();
  const academicOptions = await getAcademicOptions(user.id);
  const stats = await getStudySessionStats(user.id);
  const recentSessions = await db
    .select()
    .from(studySessions)
    .where(recentStudySessionPredicate(user.id))
    .orderBy(...studySessionOrder())
    .limit(8);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Focus timer</p>
          <h1>Study timer</h1>
          <p className="muted">Run a focused session and save the minutes to your study history.</p>
        </div>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="grid stats-grid">
        <article className="card stat"><span className="muted">Sessions completed</span><strong>{stats.sessionsCompleted}</strong></article>
        <article className="card stat"><span className="muted">Total minutes</span><strong>{stats.totalMinutes}</strong></article>
        <article className="card stat"><span className="muted">Total hours</span><strong>{Math.round((stats.totalMinutes / 60) * 10) / 10}</strong></article>
        <article className="card stat"><span className="muted">Default focus</span><strong>25m</strong></article>
      </section>

      <section className="workspace-grid" style={{ marginTop: 18 }}>
        <StudyTimer csrfToken={csrfToken} saveAction={saveStudySessionAction} subjects={academicOptions.subjects} topics={academicOptions.topics} />
        <aside className="card">
          <h2>Recent sessions</h2>
          <div className="grid">
            {recentSessions.length ? recentSessions.map((session) => (
              <div className="item-row compact" key={session.id}>
                <strong>{session.durationMinutes} minutes</strong>
                <span className="muted">{session.endedAt ? session.endedAt.toLocaleString() : "Saved session"}</span>
              </div>
            )) : <p className="muted">No sessions saved yet.</p>}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
