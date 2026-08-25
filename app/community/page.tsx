import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { CommunityUnavailable, isCommunityUiEnabled } from "@/components/community/community-access";
import { db } from "@/db";
import { groupMembers } from "@/db/schema";
import { getCsrfToken } from "@/lib/auth/csrf";
import { currentUser } from "@/lib/auth/session";
import { createGroupAction, createPostAction, getJoinedGroups, getRecentPosts, getRecommendedGroups } from "@/lib/features/community";

const perPage = 12;

export default async function CommunityPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isCommunityUiEnabled()) {
    return (
      <AppShell>
        <CommunityUnavailable />
      </AppShell>
    );
  }
  const params = (await searchParams) ?? {};
  const requestedPage = Number(params.page || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();
  const [{ total }] = await db.select({ total: count() }).from(groupMembers).where(eq(groupMembers.userId, user.id));
  const joinedGroups = await getJoinedGroups(user.id, perPage, (page - 1) * perPage);
  const recommendedGroups = await getRecommendedGroups();
  const recentPosts = await getRecentPosts();
  const pages = Math.max(Math.ceil(total / perPage), 1);

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Community</p>
          <h1>Study groups and feed</h1>
          <p className="muted">Create groups for classes, projects, and shared study accountability.</p>
        </div>
      </header>

      {error ? <p className="notice error" role="alert">{error}</p> : null}
      {success ? <p className="notice success" role="status">{success}</p> : null}

      <section className="workspace-grid">
        <article className="card">
          <h2>Create a group</h2>
          <form action={createGroupAction} className="grid">
            <input name="csrf_token" type="hidden" value={csrfToken} />
            <label className="grid">
              <span>Name</span>
              <input maxLength={255} name="name" required />
            </label>
            <label className="grid">
              <span>Description</span>
              <textarea name="description" required rows={4} />
            </label>
            <button className="button" type="submit">Create group</button>
          </form>
        </article>

        <aside className="card">
          <h2>Post to feed</h2>
          <form action={createPostAction} className="grid">
            <input name="csrf_token" type="hidden" value={csrfToken} />
            <label className="grid">
              <span>Group</span>
              <select name="group_id">
                <option value="">General feed</option>
                {joinedGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <label className="grid">
              <span>Update</span>
              <textarea name="content" required rows={4} />
            </label>
            <button className="button secondary" type="submit">Publish</button>
          </form>
        </aside>
      </section>

      <section className="workspace-grid" style={{ marginTop: 18 }}>
        <article className="card">
          <h2>Your groups</h2>
          <div className="grid">
            {joinedGroups.length ? joinedGroups.map((group) => (
              <div className="compact-card" key={group.id}>
                <h3>{group.name}</h3>
                <p className="muted">{group.description}</p>
                <span>Members: {group.memberCount}</span>
              </div>
            )) : <p className="muted">No study groups found. Create one to invite classmates.</p>}
          </div>
          {pages > 1 ? (
            <nav className="pagination" aria-label="Group pages">
              {page > 1 ? <a href={`/community?page=${page - 1}`} rel="prev">Previous</a> : null}
              <span>Page {page} of {pages}</span>
              {page < pages ? <a href={`/community?page=${page + 1}`} rel="next">Next</a> : null}
            </nav>
          ) : null}
        </article>

        <aside className="card">
          <h2>Recommended groups</h2>
          <div className="grid">
            {recommendedGroups.length ? recommendedGroups.map((group) => (
              <div className="compact-card" key={group.id}>
                <h3>{group.name}</h3>
                <p className="muted">{group.description}</p>
                <span>Members: {group.memberCount}</span>
              </div>
            )) : <p className="muted">No groups available yet.</p>}
          </div>
        </aside>
      </section>

      <section className="grid list-grid" style={{ marginTop: 18 }}>
        {recentPosts.length ? recentPosts.map((post) => (
          <article className="card" key={post.id}>
            <p className="eyebrow">{post.groupName || "General feed"}</p>
            <h3>{post.username}</h3>
            <p className="muted">{post.content}</p>
            <time dateTime={post.createdAt.toISOString()}>{post.createdAt.toLocaleString()}</time>
          </article>
        )) : <article className="card">No community posts yet.</article>}
      </section>
    </AppShell>
  );
}
