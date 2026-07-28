import { count, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/db";
import { achievements, studySessions, tasks, userProfiles, userSettings } from "@/db/schema";
import { ensureAccountRecords } from "@/lib/account";
import { currentUser } from "@/lib/auth/session";

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  await ensureAccountRecords(user);
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1);
  const recentAchievements = await db
    .select()
    .from(achievements)
    .where(eq(achievements.userId, user.id))
    .orderBy(desc(achievements.unlockedAt))
    .limit(6);
  const [minutes] = await db
    .select({ total: sql<number>`coalesce(sum(${studySessions.durationMinutes}), 0)` })
    .from(studySessions)
    .where(eq(studySessions.userId, user.id));
  const [completed] = await db
    .select({ total: count() })
    .from(tasks)
    .where(eq(tasks.userId, user.id));
  const studyHours = Math.round((Number(minutes?.total ?? 0) / 60) * 10) / 10;

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Student profile</p>
          <h1>{profile?.displayName || user.username}</h1>
          <p className="muted">{profile?.course || "No course added yet"}{profile?.institution ? ` at ${profile.institution}` : ""}</p>
        </div>
        <a className="button secondary" href="/settings">Edit profile</a>
      </header>

      <section className="grid stats-grid">
        <article className="card stat">
          <p className="muted">Study hours</p>
          <strong>{studyHours}</strong>
        </article>
        <article className="card stat">
          <p className="muted">Completed tasks</p>
          <strong>{completed?.total ?? 0}</strong>
        </article>
        <article className="card stat">
          <p className="muted">Streak</p>
          <strong>{user.streakDays}</strong>
        </article>
        <article className="card stat">
          <p className="muted">Visibility</p>
          <strong>{profile?.profileVisibility ?? "private"}</strong>
        </article>
      </section>

      <section className="workspace-grid" style={{ marginTop: 18 }}>
        <article className="card">
          <h2>About</h2>
          <p>{profile?.bio || "No bio added yet."}</p>
          <div className="grid">
            <p className="muted">Field: {profile?.fieldOfStudy || "Not set"}</p>
            <p className="muted">Education level: {profile?.educationLevel || "Not set"}</p>
            <p className="muted">Country: {profile?.country || "Not set"}</p>
            <p className="muted">Language: {settings?.language || "en"}</p>
          </div>
        </article>

        <aside className="card">
          <h2>Achievements</h2>
          <ul className="feature-list">
            {recentAchievements.length ? (
              recentAchievements.map((achievement) => (
                <li key={achievement.id}>
                  <span>
                    <strong>{achievement.title || "Achievement"}</strong>
                    <br />
                    <span className="muted">{achievement.description || "Unlocked while studying."}</span>
                  </span>
                </li>
              ))
            ) : (
              <li><span className="muted">No achievements unlocked yet.</span></li>
            )}
          </ul>
        </aside>
      </section>
    </AppShell>
  );
}
