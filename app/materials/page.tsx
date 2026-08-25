import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/db";
import { studyMaterials } from "@/db/schema";
import { getCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { getAcademicOptions } from "@/lib/features/academic";
import { deleteStudyMaterialAction, materialOrder, materialSearchPredicate, maxMaterialSizeBytes } from "@/lib/features/materials";
import { sanitizePlain } from "@/lib/text";

const perPage = 12;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(Math.round(bytes / 1024), 1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function MaterialsPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const query = sanitizePlain(typeof params.q === "string" ? params.q : "").slice(0, 128);
  const parsedPage = Number(params.page || 1);
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();
  const academicOptions = await getAcademicOptions(user.id);
  const predicate = materialSearchPredicate(user.id, query);
  const [{ total }] = await db.select({ total: count() }).from(studyMaterials).where(predicate);
  const pages = Math.max(Math.ceil(total / perPage), 1);
  const page = Math.min(requestedPage, pages);
  const rows = await db
    .select()
    .from(studyMaterials)
    .where(predicate)
    .orderBy(...materialOrder())
    .limit(perPage)
    .offset((page - 1) * perPage);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Study library</p>
          <h1>Materials</h1>
          <p className="muted">Upload PDFs, slides, documents, images and reading files for your subjects.</p>
        </div>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="workspace-grid">
        <article className="card">
          <h2>Upload material</h2>
          <form action="/materials/upload" className="grid" encType="multipart/form-data" method="post">
            <input name="csrf_token" type="hidden" value={csrfToken} />
            <label className="grid">
              <span>Title</span>
              <input maxLength={255} name="title" placeholder="Biology chapter 4 notes" />
            </label>
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
            <label className="grid">
              <span>File</span>
              <input
                accept=".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx"
                name="material"
                required
                type="file"
              />
            </label>
            <p className="muted">Maximum size: {formatFileSize(maxMaterialSizeBytes)}. Files are private to your account.</p>
            <button className="button" type="submit">Upload study material</button>
          </form>
        </article>

        <aside className="card">
          <h2>Find material</h2>
          <form className="grid">
            <label className="grid">
              <span>Search</span>
              <input defaultValue={query} name="q" placeholder="Subject, title or filename" />
            </label>
            <button className="button secondary" type="submit">Search library</button>
          </form>
        </aside>
      </section>

      <section className="grid materials-grid" style={{ marginTop: 18 }}>
        {rows.length ? (
          rows.map((material) => (
            <article className="card material-card" key={material.id}>
              <div>
                <p className="eyebrow">{material.subject || "General"}</p>
                <h3>{material.title}</h3>
                <p className="muted">{material.originalFilename}</p>
                <p className="muted">{material.mimeType} - {formatFileSize(material.fileSizeBytes)}</p>
              </div>
              <div className="inline-actions">
                <a className="button secondary" href={`/materials/${material.id}/download`}>Download</a>
                <form action={deleteStudyMaterialAction}>
                  <input name="csrf_token" type="hidden" value={csrfToken} />
                  <input name="material_id" type="hidden" value={material.id} />
                  <button className="link-button danger-link" type="submit">Delete</button>
                </form>
              </div>
            </article>
          ))
        ) : (
          <article className="card">No study materials uploaded yet.</article>
        )}
      </section>

      {pages > 1 ? (
        <nav className="pagination" aria-label="Study material pages">
          {page > 1 ? <a href={`/materials?q=${encodeURIComponent(query)}&page=${page - 1}`}>Previous</a> : null}
          <span>Page {page} of {pages}</span>
          {page < pages ? <a href={`/materials?q=${encodeURIComponent(query)}&page=${page + 1}`}>Next</a> : null}
        </nav>
      ) : null}
    </AppShell>
  );
}
