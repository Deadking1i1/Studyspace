import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { createNoteAction, editNoteAction, noteOrder, noteSearchPredicate, updateNoteStateAction } from "@/lib/features/notes";
import { currentUser } from "@/lib/auth/session";
import { getCsrfToken } from "@/lib/auth/csrf";
import { sanitizePlain, summarizeText } from "@/lib/text";

const perPage = 12;

export default async function NotesPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const query = sanitizePlain(typeof params.q === "string" ? params.q : "");
  const showArchived = params.archived === "1";
  const page = Math.max(Number(params.page || 1), 1);
  const summaryId = Number(params.summary || 0);
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();
  const predicate = noteSearchPredicate(user.id, query, showArchived);
  const [{ total }] = await db.select({ total: count() }).from(notes).where(predicate);
  const rows = await db
    .select()
    .from(notes)
    .where(predicate)
    .orderBy(...noteOrder())
    .limit(perPage)
    .offset((page - 1) * perPage);
  const summaryNote = summaryId ? rows.find((note) => note.id === summaryId) : null;
  const pages = Math.max(Math.ceil(total / perPage), 1);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Knowledge base</p>
          <h1>Notes</h1>
          <p className="muted">Capture study ideas, organize subjects, and create quick summaries.</p>
        </div>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="workspace-grid">
        <article className="card">
          <h2>New note</h2>
          <form action={createNoteAction} className="grid">
            <input name="csrf_token" type="hidden" value={csrfToken} />
            <label className="grid">
              <span>Title</span>
              <input maxLength={255} name="title" required />
            </label>
            <label className="grid">
              <span>Content</span>
              <textarea name="content" required rows={7} />
            </label>
            <div className="form-grid-2">
              <label className="grid">
                <span>Subject</span>
                <input maxLength={128} name="subject" />
              </label>
              <label className="grid">
                <span>Tags</span>
                <input maxLength={255} name="tags" />
              </label>
            </div>
            <label className="grid">
              <span>Visibility</span>
              <select defaultValue="private" name="visibility">
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </label>
            <button className="button" type="submit">Save note</button>
          </form>
        </article>

        <aside className="card">
          <h2>Filter</h2>
          <form className="grid">
            <label className="grid">
              <span>Search</span>
              <input defaultValue={query} name="q" />
            </label>
            <label className="check-row">
              <input defaultChecked={showArchived} name="archived" type="checkbox" value="1" />
              <span>Show archived</span>
            </label>
            <button className="button secondary" type="submit">Apply filter</button>
          </form>
        </aside>
      </section>

      {summaryNote ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h2>Summary</h2>
          <p>{summarizeText(summaryNote.content)}</p>
        </section>
      ) : null}

      <section className="grid notes-grid" style={{ marginTop: 18 }}>
        {rows.length ? (
          rows.map((note) => (
            <article className="card note-card" key={note.id}>
              <div>
                <p className="eyebrow">{note.subject || "General"}</p>
                <h3>{note.title}</h3>
                <p className="muted">{note.content.slice(0, 220)}{note.content.length > 220 ? "..." : ""}</p>
              </div>
              <div className="inline-actions">
                <a href={`/notes?summary=${note.id}`}>Summarize</a>
                <form action={updateNoteStateAction}>
                  <input name="csrf_token" type="hidden" value={csrfToken} />
                  <input name="note_id" type="hidden" value={note.id} />
                  <input name="action" type="hidden" value="pin" />
                  <button className="link-button" type="submit">{note.isPinned ? "Unpin" : "Pin"}</button>
                </form>
                <form action={updateNoteStateAction}>
                  <input name="csrf_token" type="hidden" value={csrfToken} />
                  <input name="note_id" type="hidden" value={note.id} />
                  <input name="action" type="hidden" value="favorite" />
                  <button className="link-button" type="submit">{note.isFavorite ? "Unfavorite" : "Favorite"}</button>
                </form>
                <form action={updateNoteStateAction}>
                  <input name="csrf_token" type="hidden" value={csrfToken} />
                  <input name="note_id" type="hidden" value={note.id} />
                  <input name="action" type="hidden" value={note.isArchived ? "restore" : "archive"} />
                  <button className="link-button" type="submit">{note.isArchived ? "Restore" : "Archive"}</button>
                </form>
                <form action={updateNoteStateAction}>
                  <input name="csrf_token" type="hidden" value={csrfToken} />
                  <input name="note_id" type="hidden" value={note.id} />
                  <input name="action" type="hidden" value="delete" />
                  <button className="link-button danger-link" type="submit">Delete</button>
                </form>
              </div>
              <details className="edit-panel">
                <summary>Edit note</summary>
                <form action={editNoteAction} className="grid">
                  <input name="csrf_token" type="hidden" value={csrfToken} />
                  <input name="note_id" type="hidden" value={note.id} />
                  <label className="grid">
                    <span>Title</span>
                    <input defaultValue={note.title} maxLength={255} name="title" required />
                  </label>
                  <label className="grid">
                    <span>Content</span>
                    <textarea defaultValue={note.content} name="content" required rows={4} />
                  </label>
                  <div className="form-grid-2">
                    <label className="grid">
                      <span>Subject</span>
                      <input defaultValue={note.subject ?? ""} maxLength={128} name="subject" />
                    </label>
                    <label className="grid">
                      <span>Tags</span>
                      <input defaultValue={note.tags ?? ""} maxLength={255} name="tags" />
                    </label>
                  </div>
                  <label className="grid">
                    <span>Visibility</span>
                    <select defaultValue={note.isPublic ? "public" : "private"} name="visibility">
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </select>
                  </label>
                  <button className="button secondary" type="submit">Save note changes</button>
                </form>
              </details>
            </article>
          ))
        ) : (
          <article className="card">You do not have any notes here yet.</article>
        )}
      </section>

      {pages > 1 ? (
        <nav className="pagination" aria-label="Notes pages">
          {page > 1 ? <a href={`/notes?page=${page - 1}`}>Previous</a> : null}
          <span>Page {page} of {pages}</span>
          {page < pages ? <a href={`/notes?page=${page + 1}`}>Next</a> : null}
        </nav>
      ) : null}
    </AppShell>
  );
}
