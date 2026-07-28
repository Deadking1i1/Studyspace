import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { markAllNotificationsReadAction, markNotificationReadAction, notificationOrder } from "@/lib/features/notifications";

const perPage = 25;

export default async function NotificationsPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const page = Math.max(Number(params.page || 1), 1);
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();
  const [{ total }] = await db.select({ total: count() }).from(notifications).where(eq(notifications.userId, user.id));
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(...notificationOrder())
    .limit(perPage)
    .offset((page - 1) * perPage);
  const pages = Math.max(Math.ceil(total / perPage), 1);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1>Updates</h1>
          <p className="muted">Reminders and important Study Space activity appear here.</p>
        </div>
        {rows.some((notification) => !notification.isRead) ? (
          <form action={markAllNotificationsReadAction}>
            <input name="csrf_token" type="hidden" value={csrfToken} />
            <button className="button secondary" type="submit">Mark all read</button>
          </form>
        ) : null}
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="grid list-grid">
        {rows.length ? rows.map((notification) => (
          <article className={`card item-row ${notification.isRead ? "" : "unread-item"}`} key={notification.id}>
            <div>
              <h3>{notification.title || "Notification"}</h3>
              <p className="muted">{notification.message}</p>
              <span className="muted">{notification.createdAt.toLocaleString()}</span>
            </div>
            {!notification.isRead ? (
              <form action={markNotificationReadAction}>
                <input name="csrf_token" type="hidden" value={csrfToken} />
                <input name="notification_id" type="hidden" value={notification.id} />
                <button className="link-button" type="submit">Mark read</button>
              </form>
            ) : null}
          </article>
        )) : <article className="card">No new notifications. You will see reminders here.</article>}
      </section>

      {pages > 1 ? (
        <nav className="pagination" aria-label="Notification pages">
          {page > 1 ? <a href={`/notifications?page=${page - 1}`}>Previous</a> : null}
          <span>Page {page} of {pages}</span>
          {page < pages ? <a href={`/notifications?page=${page + 1}`}>Next</a> : null}
        </nav>
      ) : null}
    </AppShell>
  );
}
