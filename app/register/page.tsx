import Link from "next/link";
import { UserPlus } from "lucide-react";
import { registerAction } from "@/lib/auth/actions";
import { getCsrfToken } from "@/lib/auth/csrf";

export default async function RegisterPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();

  return (
    <main className="main" style={{ maxWidth: 980 }}>
      <section className="card" style={{ marginTop: 64 }}>
        <p className="eyebrow">Start studying</p>
        <h1>Create account</h1>
        <p className="muted">Use a strong password so your notes, chats and study history stay protected.</p>
        {error ? <p className="notice error">{error}</p> : null}
        {success ? <p className="notice success">{success}</p> : null}

        <form action={registerAction} className="grid" style={{ marginTop: 24 }}>
          <input name="csrf_token" type="hidden" value={csrfToken} />
          <label className="grid">
            <span>Username</span>
            <input autoComplete="username" maxLength={128} name="username" required />
          </label>
          <label className="grid">
            <span>Email</span>
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label className="grid">
            <span>Password</span>
            <input autoComplete="new-password" minLength={8} name="password" required type="password" />
          </label>
          <label className="grid">
            <span>Confirm password</span>
            <input autoComplete="new-password" minLength={8} name="confirm_password" required type="password" />
          </label>
          <button className="button" type="submit">
            <UserPlus size={18} aria-hidden="true" />
            Create account
          </button>
          <div className="inline-actions">
            <Link href="/login">Already have an account?</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
