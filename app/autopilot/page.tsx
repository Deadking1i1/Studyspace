import { AlertCircle, BookOpen, CalendarDays, CheckCircle2, Clock3, Layers, Target } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import {
  createAcademicDeadlineAction,
  createSubjectAction,
  createTopicAction,
  getAcademicAutopilot,
  updateAcademicDeadlineStatusAction,
} from "@/lib/features/academic";

function formatDate(value: string | Date | null) {
  if (!value) return "No date";
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function urgencyCopy(urgency: "low" | "medium" | "high") {
  if (urgency === "high") return "High priority";
  if (urgency === "medium") return "Medium priority";
  return "Low priority";
}

export default async function AcademicAutopilotPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();
  const autopilot = await getAcademicAutopilot(user.id);
  const primary = autopilot.primaryRecommendation;

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Academic autopilot</p>
          <h1>What should I study now?</h1>
          <p className="muted">Build your academic map, then let Study Space pick the next focused session from deadlines, mastery, materials, tasks and study history.</p>
        </div>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="autopilot-hero card">
        {primary ? (
          <>
            <div>
              <p className="eyebrow">{urgencyCopy(primary.urgencyLabel)}</p>
              <h2>Study {primary.subject.name}</h2>
              <p className="muted">{primary.reason}.</p>
            </div>
            <div className="autopilot-score">
              <strong>{primary.score}</strong>
              <span>priority score</span>
            </div>
            <div className="autopilot-next">
              <Clock3 size={20} aria-hidden="true" />
              <span>Suggested session</span>
              <strong>{primary.suggestedMinutes} minutes</strong>
              {primary.weakestTopic ? <small>Focus topic: {primary.weakestTopic.name}</small> : <small>Add topics to sharpen recommendations.</small>}
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="eyebrow">Setup needed</p>
              <h2>Add your first subject</h2>
              <p className="muted">Autopilot needs at least one subject before it can recommend a study session.</p>
            </div>
            <div className="autopilot-score">
              <strong>0</strong>
              <span>signals ready</span>
            </div>
          </>
        )}
      </section>

      <section className="stats-grid grid" style={{ marginTop: 18 }}>
        <article className="card stat"><span className="muted">Subjects</span><strong>{autopilot.subjects.length}</strong></article>
        <article className="card stat"><span className="muted">Topics</span><strong>{autopilot.topics.length}</strong></article>
        <article className="card stat"><span className="muted">Open deadlines</span><strong>{autopilot.openDeadlines.length}</strong></article>
        <article className="card stat"><span className="muted">Top priority</span><strong>{primary?.score ?? 0}</strong></article>
      </section>

      <section className="workspace-grid" style={{ marginTop: 18 }}>
        <article className="card">
          <h2>Build academic map</h2>
          <div className="autopilot-form-stack">
            <form action={createSubjectAction} className="grid">
              <input name="csrf_token" type="hidden" value={csrfToken} />
              <h3>Subject</h3>
              <label className="grid">
                <span>Name</span>
                <input maxLength={160} name="name" placeholder="Computer Applications Technology" required />
              </label>
              <div className="form-grid-2">
                <label className="grid">
                  <span>Code</span>
                  <input maxLength={64} name="code" placeholder="CAT" />
                </label>
                <label className="grid">
                  <span>Target mastery</span>
                  <input defaultValue={80} max={100} min={50} name="target_mastery" type="number" />
                </label>
              </div>
              <label className="grid">
                <span>Color</span>
                <select defaultValue="cyan" name="color">
                  <option value="cyan">Cyan</option>
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                  <option value="purple">Purple</option>
                  <option value="orange">Orange</option>
                  <option value="pink">Pink</option>
                </select>
              </label>
              <button className="button" type="submit">Add subject</button>
            </form>

            <form action={createTopicAction} className="grid">
              <input name="csrf_token" type="hidden" value={csrfToken} />
              <h3>Topic</h3>
              <label className="grid">
                <span>Subject</span>
                <select name="subject_id" required>
                  <option value="">Choose subject</option>
                  {autopilot.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </label>
              <label className="grid">
                <span>Topic name</span>
                <input maxLength={180} name="name" placeholder="Database normalization" required />
              </label>
              <label className="grid">
                <span>Current mastery</span>
                <input defaultValue={0} max={100} min={0} name="mastery_score" type="number" />
              </label>
              <label className="grid">
                <span>Description</span>
                <textarea name="description" rows={3} />
              </label>
              <button className="button secondary" type="submit">Add topic</button>
            </form>
          </div>
        </article>

        <aside className="grid">
          <article className="card">
            <h2>Academic deadline</h2>
            <form action={createAcademicDeadlineAction} className="grid">
              <input name="csrf_token" type="hidden" value={csrfToken} />
              <label className="grid">
                <span>Title</span>
                <input maxLength={255} name="title" placeholder="Maths paper 1 exam" required />
              </label>
              <label className="grid">
                <span>Subject</span>
                <select name="subject_id">
                  <option value="">No subject yet</option>
                  {autopilot.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </label>
              <div className="form-grid-2">
                <label className="grid">
                  <span>Type</span>
                  <select defaultValue="assignment" name="type">
                    <option value="assignment">Assignment</option>
                    <option value="exam">Exam</option>
                    <option value="quiz">Quiz</option>
                    <option value="reading">Reading</option>
                    <option value="project">Project</option>
                    <option value="revision">Revision</option>
                  </select>
                </label>
                <label className="grid">
                  <span>Due date</span>
                  <input name="due_date" required type="date" />
                </label>
              </div>
              <div className="form-grid-2">
                <label className="grid">
                  <span>Workload minutes</span>
                  <input defaultValue={60} max={720} min={15} name="estimated_minutes" type="number" />
                </label>
                <label className="grid">
                  <span>Importance</span>
                  <input defaultValue={3} max={5} min={1} name="weight" type="number" />
                </label>
              </div>
              <label className="grid">
                <span>Notes</span>
                <textarea name="notes" rows={3} />
              </label>
              <button className="button" type="submit">Add deadline</button>
            </form>
          </article>
        </aside>
      </section>

      <section className="workspace-grid" style={{ marginTop: 18 }}>
        <article className="card">
          <div className="card-title-row">
            <h2>Recommendation queue</h2>
            <Target size={18} aria-hidden="true" />
          </div>
          <div className="grid">
            {autopilot.recommendations.length ? autopilot.recommendations.map((item) => (
              <div className="recommendation-row" key={item.subject.id}>
                <div>
                  <strong>{item.subject.name}</strong>
                  <p className="muted">{item.reason}.</p>
                  <div className="signal-row">
                    <span><BookOpen size={14} aria-hidden="true" /> {item.noteCount} notes</span>
                    <span><Layers size={14} aria-hidden="true" /> {item.flashcardCount} cards</span>
                    <span><CalendarDays size={14} aria-hidden="true" /> {item.nearestDeadline ? formatDate(item.nearestDeadline.dueDate) : "No deadline"}</span>
                  </div>
                </div>
                <div className="priority-pill">{item.score}</div>
              </div>
            )) : <p className="muted">Add subjects, topics, and deadlines to create your first recommendation.</p>}
          </div>
        </article>

        <aside className="grid">
          <article className="card">
            <h2>Open deadlines</h2>
            <div className="grid">
              {autopilot.openDeadlines.length ? autopilot.openDeadlines.map((deadline) => (
                <div className="item-row compact" key={deadline.id}>
                  <span>
                    <strong>{deadline.title}</strong>
                    <br />
                    <span className="muted">{deadline.type} - due {formatDate(deadline.dueDate)}</span>
                  </span>
                  <form action={updateAcademicDeadlineStatusAction}>
                    <input name="csrf_token" type="hidden" value={csrfToken} />
                    <input name="deadline_id" type="hidden" value={deadline.id} />
                    <input name="status" type="hidden" value="done" />
                    <button className="link-button" type="submit"><CheckCircle2 size={18} aria-label="Mark done" /></button>
                  </form>
                </div>
              )) : <p className="muted">No open academic deadlines yet.</p>}
            </div>
          </article>

          <article className="card">
            <div className="card-title-row">
              <h2>Unlinked study data</h2>
              <AlertCircle size={18} aria-hidden="true" />
            </div>
            <p className="muted">These records exist, but are not attached to a subject yet, so Autopilot cannot fully use them.</p>
            <ul className="feature-list">
              <li><span>Materials</span><strong>{autopilot.unlinked.materials}</strong></li>
              <li><span>Notes</span><strong>{autopilot.unlinked.notes}</strong></li>
              <li><span>Tasks</span><strong>{autopilot.unlinked.tasks}</strong></li>
              <li><span>Flashcards</span><strong>{autopilot.unlinked.flashcards}</strong></li>
            </ul>
          </article>
        </aside>
      </section>
    </AppShell>
  );
}
