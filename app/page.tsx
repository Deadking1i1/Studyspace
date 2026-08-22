import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { BookOpen, CalendarDays, CheckCircle2, Clock3, FileText, Flame, Headphones, Layers, Lightbulb, Plus, Trophy } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/db";
import { achievements, events, notes, studyMaterials, studySessions, tasks, userProfiles, userSettings } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { getAcademicAutopilot } from "@/lib/features/academic";
import { normalizeTheme, themeDefinitions } from "@/lib/themes";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | Date | null) {
  if (!value) return "No date";
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

export default async function DashboardPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const today = todayIso();

  const [
    openTaskRows,
    completedTaskCount,
    upcomingEvents,
    recentNotes,
    recentAchievements,
    studyStats,
    materialCount,
    autopilot,
    environmentSettings,
    profileRows,
  ] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), eq(tasks.completed, false), eq(tasks.archived, false)))
      .orderBy(tasks.dueDate, desc(tasks.id))
      .limit(5),
    db
      .select({ total: count() })
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), eq(tasks.completed, true), eq(tasks.archived, false))),
    db
      .select()
      .from(events)
      .where(and(eq(events.userId, user.id), gte(events.eventDate, today)))
      .orderBy(events.eventDate)
      .limit(4),
    db
      .select()
      .from(notes)
      .where(and(eq(notes.userId, user.id), eq(notes.isArchived, false)))
      .orderBy(desc(notes.updatedAt), desc(notes.createdAt))
      .limit(4),
    db
      .select()
      .from(achievements)
      .where(eq(achievements.userId, user.id))
      .orderBy(desc(achievements.unlockedAt), desc(achievements.id))
      .limit(3),
    db
      .select({
        sessions: count(),
        minutes: sql<number>`coalesce(sum(${studySessions.durationMinutes}), 0)`,
      })
      .from(studySessions)
      .where(eq(studySessions.userId, user.id)),
    db.select({ total: count() }).from(studyMaterials).where(eq(studyMaterials.userId, user.id)),
    getAcademicAutopilot(user.id),
    db.select({ theme: userSettings.theme }).from(userSettings).where(eq(userSettings.userId, user.id)).limit(1),
    db.select({ displayName: userProfiles.displayName }).from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1),
  ]);

  const completed = completedTaskCount[0]?.total ?? 0;
  const open = openTaskRows.length;
  const totalVisibleTasks = completed + open;
  const completion = totalVisibleTasks ? Math.round((completed / totalVisibleTasks) * 100) : 0;
  const totalMinutes = Number(studyStats[0]?.minutes ?? 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const activeTheme = themeDefinitions.find((theme) => theme.id === normalizeTheme(environmentSettings[0]?.theme));
  const displayName = profileRows[0]?.displayName?.trim() || user.username;

  return (
    <AppShell>
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">Student command center</p>
          <h1>Good evening, {displayName}</h1>
          <p className="muted">One clear place for today&apos;s work, focus, and progress.</p>
        </div>
        <div className="focus-weather">
          <span>{activeTheme?.name ?? "Rain Focus"}</span>
          <strong>Deep work</strong>
        </div>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="dashboard-grid">
        <article className="card autopilot-dashboard-card">
          <div className="card-title-row">
            <h2>Academic autopilot</h2>
            <Lightbulb size={18} aria-hidden="true" />
          </div>
          {autopilot.primaryRecommendation ? (
            <>
              <p className="eyebrow">{autopilot.primaryRecommendation.urgencyLabel} priority</p>
              <h3>Study {autopilot.primaryRecommendation.subject.name}</h3>
              <p className="muted">{autopilot.primaryRecommendation.reason}.</p>
              <div className="metric-pair">
                <span><strong>{autopilot.primaryRecommendation.suggestedMinutes}m</strong> session</span>
                <span><strong>{autopilot.primaryRecommendation.score}</strong> score</span>
              </div>
            </>
          ) : (
            <p className="muted">Add subjects and deadlines to unlock your first study recommendation.</p>
          )}
          <a className="text-action" href="/autopilot"><Lightbulb size={16} aria-hidden="true" /> Open Autopilot</a>
        </article>

        <article className="card focus-card">
          <div className="card-title-row">
            <h2>Focus timer</h2>
            <Clock3 size={18} aria-hidden="true" />
          </div>
          <div className="timer-orbit">
            <strong>45:00</strong>
            <span>Focus</span>
          </div>
          <div className="inline-actions">
            <a className="button" href="/timer">Start session</a>
            <a className="button secondary" href="/spotify">Music</a>
          </div>
        </article>

        <article className="card today-card">
          <div className="card-title-row">
            <h2>Today's tasks</h2>
            <a href="/tasks">View all</a>
          </div>
          <p className="muted">{completed} completed · {completion}% progress</p>
          <div className="progress-track"><span style={{ width: `${completion}%` }} /></div>
          <div className="dashboard-list">
            {openTaskRows.length ? openTaskRows.map((task) => (
              <a className="dashboard-list-item" href="/tasks" key={task.id}>
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{task.task || "Untitled task"}</span>
                <small>{task.dueDate ? formatDate(task.dueDate) : task.priority}</small>
              </a>
            )) : <p className="muted">No open tasks. Add one when you are ready.</p>}
          </div>
          <a className="text-action" href="/tasks"><Plus size={16} aria-hidden="true" /> Add task</a>
        </article>

        <article className="card streak-card">
          <div className="card-title-row">
            <h2>Study streak</h2>
            <Flame size={18} aria-hidden="true" />
          </div>
          <strong className="big-number">{user.streakDays || 0}</strong>
          <span className="muted">days</span>
          <div className="bar-week" aria-hidden="true">
            {[42, 28, 52, 38, 58, 50, 78].map((height, index) => <span key={index} style={{ height }} />)}
          </div>
        </article>

        <article className="card focus-summary-card">
          <h2>Today's focus</h2>
          <strong>{totalHours}h</strong>
          <p className="muted">total study time logged</p>
          <div className="progress-track"><span style={{ width: `${Math.min(Math.round((totalMinutes / 360) * 100), 100)}%` }} /></div>
          <div className="metric-pair">
            <span><strong>{studyStats[0]?.sessions ?? 0}</strong> sessions</span>
            <span><strong>{materialCount[0]?.total ?? 0}</strong> materials</span>
          </div>
        </article>

        <article className="card upcoming-card">
          <div className="card-title-row">
            <h2>Upcoming</h2>
            <a href="/calendar">Calendar</a>
          </div>
          <div className="dashboard-list">
            {upcomingEvents.length ? upcomingEvents.map((event) => (
              <a className="dashboard-list-item" href="/calendar" key={event.id}>
                <CalendarDays size={16} aria-hidden="true" />
                <span>{event.name || "Study event"}</span>
                <small>{formatDate(event.eventDate)}</small>
              </a>
            )) : <p className="muted">No upcoming events yet.</p>}
          </div>
        </article>

        <article className="card recent-notes-card">
          <div className="card-title-row">
            <h2>Recent notes</h2>
            <a href="/notes">View all</a>
          </div>
          <div className="dashboard-list">
            {recentNotes.length ? recentNotes.map((note) => (
              <a className="dashboard-list-item" href="/notes" key={note.id}>
                <BookOpen size={16} aria-hidden="true" />
                <span>{note.title}</span>
                <small>{note.subject || "General"}</small>
              </a>
            )) : <p className="muted">Create your first note to build your knowledge base.</p>}
          </div>
        </article>

        <article className="card achievements-preview">
          <div className="card-title-row">
            <h2>Achievements</h2>
            <a href="/achievements">View all</a>
          </div>
          <div className="badge-row">
            {(recentAchievements.length ? recentAchievements : [
              { id: -1, title: "Focus Master", description: "Complete study sessions" },
              { id: -2, title: "Goal Getter", description: "Finish planned tasks" },
              { id: -3, title: "Top Performer", description: "Keep your streak alive" },
            ]).map((achievement) => (
              <div className="achievement-badge" key={achievement.id}>
                <Trophy size={26} aria-hidden="true" />
                <strong>{achievement.title || "Achievement"}</strong>
                <span>{achievement.description || "Study milestone"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card quick-actions-card">
          <h2>Quick actions</h2>
          <div className="quick-action-grid">
            <a href="/notes"><BookOpen size={18} aria-hidden="true" /> New note</a>
            <a href="/autopilot"><Lightbulb size={18} aria-hidden="true" /> Study now</a>
            <a href="/materials"><FileText size={18} aria-hidden="true" /> Upload material</a>
            <a href="/flashcards"><Layers size={18} aria-hidden="true" /> Review cards</a>
            <a href="/spotify"><Headphones size={18} aria-hidden="true" /> Focus music</a>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
