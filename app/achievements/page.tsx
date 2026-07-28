import { count, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/db";
import { achievements } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";

const perPage = 12;

export default async function AchievementsPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const page = Math.max(Number(params.page || 1), 1);
  const [{ total }] = await db.select({ total: count() }).from(achievements).where(eq(achievements.userId, user.id));
  const rows = await db
    .select()
    .from(achievements)
    .where(eq(achievements.userId, user.id))
    .orderBy(desc(achievements.unlockedAt), desc(achievements.id))
    .limit(perPage)
    .offset((page - 1) * perPage);
  const pages = Math.max(Math.ceil(total / perPage), 1);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Progress</p>
          <h1>Achievements</h1>
          <p className="muted">Milestones you have unlocked while building stronger study habits.</p>
        </div>
      </header>

      <section className="grid card-grid">
        {rows.length ? rows.map((achievement) => (
          <article className="card achievement-card" key={achievement.id}>
            <p className="eyebrow">Unlocked</p>
            <h3>{achievement.title || "Achievement"}</h3>
            <p className="muted">{achievement.description}</p>
            <span>{achievement.unlockedAt ? achievement.unlockedAt.toLocaleString() : "Recently"}</span>
          </article>
        )) : <article className="card">No achievements unlocked yet. Keep studying to earn badges.</article>}
      </section>

      {pages > 1 ? (
        <nav className="pagination" aria-label="Achievement pages">
          {page > 1 ? <a href={`/achievements?page=${page - 1}`}>Previous</a> : null}
          <span>Page {page} of {pages}</span>
          {page < pages ? <a href={`/achievements?page=${page + 1}`}>Next</a> : null}
        </nav>
      ) : null}
    </AppShell>
  );
}
