import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/db";
import { flashcardCards, flashcards } from "@/db/schema";
import { getCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { createFlashcardAction, deleteFlashcardAction, flashcardOrder, trendingFlashcardOrder } from "@/lib/features/flashcards";

const perPage = 12;

export default async function FlashcardsPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const page = Math.max(Number(params.page || 1), 1);
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();
  const [{ total }] = await db.select({ total: count() }).from(flashcards).where(eq(flashcards.userId, user.id));
  const rows = await db
    .select({
      id: flashcards.id,
      title: flashcards.title,
      createdAt: flashcards.createdAt,
      isPublic: flashcards.isPublic,
      front: flashcardCards.front,
      back: flashcardCards.back,
    })
    .from(flashcards)
    .leftJoin(flashcardCards, eq(flashcards.id, flashcardCards.flashcardId))
    .where(eq(flashcards.userId, user.id))
    .orderBy(...flashcardOrder())
    .limit(perPage)
    .offset((page - 1) * perPage);
  const trending = await db
    .select({
      id: flashcards.id,
      title: flashcards.title,
      front: flashcardCards.front,
      back: flashcardCards.back,
    })
    .from(flashcards)
    .leftJoin(flashcardCards, eq(flashcards.id, flashcardCards.flashcardId))
    .where(eq(flashcards.isPublic, true))
    .orderBy(...trendingFlashcardOrder())
    .limit(6);
  const pages = Math.max(Math.ceil(total / perPage), 1);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Memory practice</p>
          <h1>Flashcards</h1>
          <p className="muted">Create quick study prompts and review public cards shared by other students.</p>
        </div>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="workspace-grid">
        <article className="card">
          <h2>Create flashcard</h2>
          <form action={createFlashcardAction} className="grid">
            <input name="csrf_token" type="hidden" value={csrfToken} />
            <label className="grid">
              <span>Title</span>
              <input maxLength={255} name="title" required />
            </label>
            <label className="grid">
              <span>Question</span>
              <textarea name="question" required rows={4} />
            </label>
            <label className="grid">
              <span>Answer</span>
              <textarea name="answer" required rows={4} />
            </label>
            <label className="grid">
              <span>Visibility</span>
              <select defaultValue="private" name="visibility">
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </label>
            <button className="button" type="submit">Save flashcard</button>
          </form>
        </article>

        <aside className="card">
          <h2>Trending public cards</h2>
          <div className="grid">
            {trending.length ? trending.map((card) => (
              <details className="compact-card" key={card.id}>
                <summary>{card.title}</summary>
                <p className="muted">{card.front}</p>
                <strong>{card.back}</strong>
              </details>
            )) : <p className="muted">No public flashcards yet.</p>}
          </div>
        </aside>
      </section>

      <section className="grid card-grid" style={{ marginTop: 18 }}>
        {rows.length ? rows.map((card) => (
          <article className="card flashcard-card" key={card.id}>
            <div>
              <p className="eyebrow">{card.isPublic ? "Public" : "Private"}</p>
              <h3>{card.title}</h3>
              <p>{card.front}</p>
            </div>
            <details>
              <summary>Show answer</summary>
              <p className="muted">{card.back || "Review the flashcard set to see answers."}</p>
            </details>
            <form action={deleteFlashcardAction}>
              <input name="csrf_token" type="hidden" value={csrfToken} />
              <input name="flashcard_id" type="hidden" value={card.id} />
              <button className="link-button danger-link" type="submit">Delete</button>
            </form>
          </article>
        )) : <article className="card">No flashcards yet. Add some to start reviewing.</article>}
      </section>

      {pages > 1 ? (
        <nav className="pagination" aria-label="Flashcard pages">
          {page > 1 ? <a href={`/flashcards?page=${page - 1}`}>Previous</a> : null}
          <span>Page {page} of {pages}</span>
          {page < pages ? <a href={`/flashcards?page=${page + 1}`}>Next</a> : null}
        </nav>
      ) : null}
    </AppShell>
  );
}
