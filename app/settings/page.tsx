import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/db";
import { securityEvents, userProfiles, userSettings } from "@/db/schema";
import {
  changePasswordAction,
  deleteAccountAction,
  logoutAction,
  requestEmailChangeAction,
  resendVerificationAction,
  saveSettingsAction,
} from "@/lib/auth/actions";
import { currentUser } from "@/lib/auth/session";
import { ensureAccountRecords } from "@/lib/account";
import { getCsrfToken } from "@/lib/auth/csrf";

export default async function SettingsPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const user = await currentUser();
  if (!user) redirect("/login");
  await ensureAccountRecords(user);
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1);
  const events = await db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.userId, user.id))
    .orderBy(desc(securityEvents.createdAt))
    .limit(8);
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();

  return (
    <AppShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Settings</h1>
          <p className="muted">Manage your Study Space profile, security and account data.</p>
        </div>
        <form action={logoutAction}>
          <input name="csrf_token" type="hidden" value={csrfToken} />
          <button className="button secondary" type="submit">Sign out</button>
        </form>
      </header>

      {error ? <p className="notice error">{error}</p> : null}
      {success ? <p className="notice success">{success}</p> : null}

      <section className="settings-grid">
        <article className="card">
          <h2>Profile</h2>
          <form action={saveSettingsAction} className="grid">
            <input name="csrf_token" type="hidden" value={csrfToken} />
            <label className="grid">
              <span>Display name</span>
              <input defaultValue={profile?.displayName ?? user.username} maxLength={128} name="display_name" />
            </label>
            <label className="grid">
              <span>Course</span>
              <input defaultValue={profile?.course ?? user.course ?? ""} maxLength={128} name="course" />
            </label>
            <label className="grid">
              <span>Bio</span>
              <textarea defaultValue={profile?.bio ?? user.bio ?? ""} maxLength={2000} name="bio" rows={4} />
            </label>
            <div className="form-grid-2">
              <label className="grid">
                <span>Institution</span>
                <input defaultValue={profile?.institution ?? ""} maxLength={255} name="institution" />
              </label>
              <label className="grid">
                <span>Field of study</span>
                <input defaultValue={profile?.fieldOfStudy ?? ""} maxLength={128} name="field_of_study" />
              </label>
              <label className="grid">
                <span>Education level</span>
                <input defaultValue={profile?.educationLevel ?? ""} maxLength={128} name="education_level" />
              </label>
              <label className="grid">
                <span>Country</span>
                <input defaultValue={profile?.country ?? ""} maxLength={128} name="country" />
              </label>
            </div>
            <label className="grid">
              <span>Profile visibility</span>
              <select defaultValue={profile?.profileVisibility ?? "private"} name="profile_visibility">
                <option value="private">Private</option>
                <option value="classmates">Classmates</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label className="check-row">
              <input defaultChecked={profile?.showEmail ?? false} name="show_email" type="checkbox" />
              <span>Show email on public profile</span>
            </label>
            <label className="check-row">
              <input defaultChecked={profile?.showAcademicProfile ?? false} name="show_academic_profile" type="checkbox" />
              <span>Show academic profile publicly</span>
            </label>
            <div className="form-grid-2">
              <label className="grid">
                <span>Theme</span>
                <select defaultValue={settings?.theme ?? "dark"} name="theme">
                  <option value="dark">Dark</option>
                  <option value="high-contrast">High contrast</option>
                </select>
              </label>
              <label className="grid">
                <span>Language</span>
                <input defaultValue={settings?.language ?? "en"} maxLength={16} name="language" />
              </label>
              <label className="grid">
                <span>Timezone</span>
                <input defaultValue={settings?.timezone ?? "UTC"} maxLength={64} name="timezone" />
              </label>
            </div>
            <label className="check-row">
              <input defaultChecked={settings?.emailNotifications ?? true} name="email_notifications" type="checkbox" />
              <span>Email notifications</span>
            </label>
            <label className="check-row">
              <input defaultChecked={settings?.studyReminders ?? true} name="study_reminders" type="checkbox" />
              <span>Study reminders</span>
            </label>
            <label className="check-row">
              <input defaultChecked={settings?.reducedMotion ?? false} name="reduced_motion" type="checkbox" />
              <span>Reduce motion</span>
            </label>
            <label className="check-row">
              <input defaultChecked={settings?.highContrast ?? false} name="high_contrast" type="checkbox" />
              <span>High contrast</span>
            </label>
            <button className="button" type="submit">Save settings</button>
          </form>
        </article>

        <aside className="grid">
          <article className="card">
            <h2>Security</h2>
            <p className="muted">Signed in as {user.email}. Email verified: {user.emailVerified ? "yes" : "no"}.</p>
            {!user.emailVerified ? (
              <form action={resendVerificationAction}>
                <input name="csrf_token" type="hidden" value={csrfToken} />
                <button className="button secondary" type="submit">Resend verification</button>
              </form>
            ) : null}
            <form action={changePasswordAction} className="grid" style={{ marginTop: 18 }}>
              <input name="csrf_token" type="hidden" value={csrfToken} />
              <label className="grid">
                <span>Current password</span>
                <input autoComplete="current-password" name="current_password" required type="password" />
              </label>
              <label className="grid">
                <span>New password</span>
                <input autoComplete="new-password" minLength={8} name="new_password" required type="password" />
              </label>
              <label className="grid">
                <span>Confirm new password</span>
                <input autoComplete="new-password" minLength={8} name="confirm_password" required type="password" />
              </label>
              <button className="button secondary" type="submit">Change password</button>
            </form>
          </article>

          <article className="card">
            <h2>Email</h2>
            <form action={requestEmailChangeAction} className="grid">
              <input name="csrf_token" type="hidden" value={csrfToken} />
              <label className="grid">
                <span>New email</span>
                <input autoComplete="email" name="new_email" required type="email" />
              </label>
              <label className="grid">
                <span>Password</span>
                <input autoComplete="current-password" name="password" required type="password" />
              </label>
              <button className="button secondary" type="submit">Request email change</button>
            </form>
          </article>

          <article className="card">
            <h2>Account data</h2>
            <div className="grid">
              <a className="button secondary" href="/api/account/export">Export account data</a>
              <form action={deleteAccountAction} className="grid">
                <input name="csrf_token" type="hidden" value={csrfToken} />
                <label className="grid">
                  <span>Password</span>
                  <input autoComplete="current-password" name="password" required type="password" />
                </label>
                <label className="grid">
                  <span>Type DELETE to close account</span>
                  <input name="confirmation" />
                </label>
                <button className="button danger" type="submit">Delete account</button>
              </form>
            </div>
          </article>

          <article className="card">
            <h2>Recent security events</h2>
            <ul className="feature-list">
              {events.map((event) => (
                <li key={event.id}>
                  <span>
                    <strong>{event.eventType}</strong>
                    <br />
                    <span className="muted">{event.createdAt?.toISOString?.() ?? ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </section>
    </AppShell>
  );
}
