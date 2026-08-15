import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { getCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { getAcademicOptions } from "@/lib/features/academic";
import { createTaskAction, taskOrder, taskStatusPredicate, updateTaskStateAction } from "@/lib/features/tasks";

const perPage = 12;

export default async function TasksPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const status = typeof params.status === "string" ? params.status : "open";
  const priority = typeof params.priority === "string" ? params.priority : "";
  const page = Math.max(Number(params.page || 1), 1);
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();
  const academicOptions = await getAcademicOptions(user.id);
  const predicate = taskStatusPredicate(user.id, status, priority);
  const [{ total }] = await db.select({ total: count() }).from(tasks).where(predicate);
  const rows = await db
    .select()
    .from(tasks)
    .where(predicate)
    .orderBy(...taskOrder())
    .limit(perPage)
    .offset((page - 1) * perPage);
  const pages = Math.max(Math.ceil(total / perPage), 1);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Planner</p>
          <h1>Tasks</h1>
          <p className="muted">Plan your work and keep the important deadlines visible.</p>
        </div>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="workspace-grid">
        <article className="card">
          <h2>New task</h2>
          <form action={createTaskAction} className="grid">
            <input name="csrf_token" type="hidden" value={csrfToken} />
            <label className="grid">
              <span>Task</span>
              <input name="task" required />
            </label>
            <div className="form-grid-2">
              <label className="grid">
                <span>Subject</span>
                <select name="subject_id">
                  <option value="">General</option>
                  {academicOptions.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid">
                <span>Topic</span>
                <select name="topic_id">
                  <option value="">No topic</option>
                  {academicOptions.topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid-2">
              <label className="grid">
                <span>Priority</span>
                <select defaultValue="medium" name="priority">
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </label>
            </div>
            <label className="grid">
              <span>Due date</span>
              <input name="due" required type="date" />
            </label>
            <button className="button" type="submit">Add task</button>
          </form>
        </article>

        <aside className="card">
          <h2>Filter</h2>
          <form className="grid">
            <label className="grid">
              <span>Status</span>
              <select defaultValue={status} name="status">
                <option value="open">Open</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="grid">
              <span>Priority</span>
              <select defaultValue={priority} name="priority">
                <option value="">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <button className="button secondary" type="submit">Apply filter</button>
          </form>
        </aside>
      </section>

      <section className="grid tasks-grid" style={{ marginTop: 18 }}>
        {rows.length ? (
          rows.map((task) => (
            <article className="card task-card" key={task.id}>
              <div>
                <h3>{task.task}</h3>
                <p className="muted">{task.subject || "General"} - {task.priority} priority - due {task.dueDate}</p>
              </div>
              <div className="inline-actions">
                {!task.completed ? (
                  <form action={updateTaskStateAction}>
                    <input name="csrf_token" type="hidden" value={csrfToken} />
                    <input name="task_id" type="hidden" value={task.id} />
                    <input name="action" type="hidden" value="complete" />
                    <button className="link-button" type="submit">Mark complete</button>
                  </form>
                ) : (
                  <form action={updateTaskStateAction}>
                    <input name="csrf_token" type="hidden" value={csrfToken} />
                    <input name="task_id" type="hidden" value={task.id} />
                    <input name="action" type="hidden" value="reopen" />
                    <button className="link-button" type="submit">Reopen</button>
                  </form>
                )}
                <form action={updateTaskStateAction}>
                  <input name="csrf_token" type="hidden" value={csrfToken} />
                  <input name="task_id" type="hidden" value={task.id} />
                  <input name="action" type="hidden" value={task.archived ? "restore" : "archive"} />
                  <button className="link-button" type="submit">{task.archived ? "Restore" : "Archive"}</button>
                </form>
                <form action={updateTaskStateAction}>
                  <input name="csrf_token" type="hidden" value={csrfToken} />
                  <input name="task_id" type="hidden" value={task.id} />
                  <input name="action" type="hidden" value="delete" />
                  <button className="link-button danger-link" type="submit">Delete</button>
                </form>
              </div>
            </article>
          ))
        ) : (
          <article className="card">No tasks in this view yet.</article>
        )}
      </section>

      {pages > 1 ? (
        <nav className="pagination" aria-label="Task pages">
          {page > 1 ? <a href={`/tasks?status=${status}&priority=${priority}&page=${page - 1}`}>Previous</a> : null}
          <span>Page {page} of {pages}</span>
          {page < pages ? <a href={`/tasks?status=${status}&priority=${priority}&page=${page + 1}`}>Next</a> : null}
        </nav>
      ) : null}
    </AppShell>
  );
}
