import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { currentUser } from "@/lib/auth/session";
import { getCsrfToken } from "@/lib/auth/csrf";
import { summarizeText } from "@/lib/text";

export default async function AssistantPage({ searchParams }: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = (await searchParams) ?? {};
  const query = typeof params.query === "string" ? params.query.slice(0, 4000) : "";
  const csrfToken = await getCsrfToken();
  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Study support</p>
          <h1>Study assistant</h1>
          <p className="muted">Condense a passage into a short starting summary without sending it to an external AI service.</p>
        </div>
      </header>
      <section className="workspace-grid">
        <article className="card">
          <form className="grid" method="get">
            <input name="csrf_token" type="hidden" value={csrfToken} />
            <label className="grid">
              <span>Text to summarize</span>
              <textarea defaultValue={query} maxLength={4000} name="query" required rows={10} />
            </label>
            <button className="button" type="submit">Summarize</button>
          </form>
        </article>
        <aside className="card">
          <h2>Summary</h2>
          <p>{query ? summarizeText(query) : "Your summary will appear here."}</p>
        </aside>
      </section>
    </AppShell>
  );
}
