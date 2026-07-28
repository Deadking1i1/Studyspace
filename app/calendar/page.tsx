import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/db";
import { events } from "@/db/schema";
import { getCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { createEventAction, deleteEventAction, eventOrder, upcomingEventsPredicate } from "@/lib/features/calendar";

const perPage = 12;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function CalendarPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const page = Math.max(Number(params.page || 1), 1);
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();
  const predicate = upcomingEventsPredicate(user.id, todayIso());
  const [{ total }] = await db.select({ total: count() }).from(events).where(predicate);
  const rows = await db.select().from(events).where(predicate).orderBy(...eventOrder()).limit(perPage).offset((page - 1) * perPage);
  const pages = Math.max(Math.ceil(total / perPage), 1);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1>Study events</h1>
          <p className="muted">Keep exams, due dates, classes, and study blocks in one place.</p>
        </div>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="workspace-grid">
        <article className="card">
          <h2>Add event</h2>
          <form action={createEventAction} className="grid">
            <input name="csrf_token" type="hidden" value={csrfToken} />
            <label className="grid">
              <span>Event</span>
              <input maxLength={255} name="name" required />
            </label>
            <label className="grid">
              <span>Date</span>
              <input name="event_date" required type="date" />
            </label>
            <label className="grid">
              <span>Notes</span>
              <textarea name="notes" rows={4} />
            </label>
            <button className="button" type="submit">Add event</button>
          </form>
        </article>

        <aside className="card">
          <h2>Upcoming</h2>
          <p className="muted">Showing future events from today onward. Past events remain preserved in the database for history and exports.</p>
        </aside>
      </section>

      <section className="grid list-grid" style={{ marginTop: 18 }}>
        {rows.length ? rows.map((event) => (
          <article className="card item-row" key={event.id}>
            <div>
              <p className="eyebrow">{event.eventDate || "No date"}</p>
              <h3>{event.name}</h3>
              {event.notes ? <p className="muted">{event.notes}</p> : null}
            </div>
            <form action={deleteEventAction}>
              <input name="csrf_token" type="hidden" value={csrfToken} />
              <input name="event_id" type="hidden" value={event.id} />
              <button className="link-button danger-link" type="submit">Delete</button>
            </form>
          </article>
        )) : <article className="card">No upcoming events yet.</article>}
      </section>

      {pages > 1 ? (
        <nav className="pagination" aria-label="Calendar pages">
          {page > 1 ? <a href={`/calendar?page=${page - 1}`}>Previous</a> : null}
          <span>Page {page} of {pages}</span>
          {page < pages ? <a href={`/calendar?page=${page + 1}`}>Next</a> : null}
        </nav>
      ) : null}
    </AppShell>
  );
}
