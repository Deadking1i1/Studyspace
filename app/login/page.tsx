import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { loginAction } from "@/lib/auth/actions";
import { getCsrfToken } from "@/lib/auth/csrf";

export default async function LoginPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();
  return (
    <main className="main" style={{ maxWidth: 980 }}>
      <section className="card" style={{ marginTop: 64 }}>
        <p className="eyebrow">Study Space account</p>
        <h1>Welcome back</h1>
        <p className="muted">Sign in with your Study Space account.</p>
        {error ? <p className="notice error">{error}</p> : null}
        {success ? <p className="notice success">{success}</p> : null}

        <form action={loginAction} className="grid" style={{ marginTop: 24 }}>
          <input name="csrf_token" type="hidden" value={csrfToken} />
          <label className="grid">
            <span>Email</span>
            <input autoComplete="email" name="email" placeholder="you@example.com" required type="email" />
          </label>
          <label className="grid">
            <span>Password</span>
            <input autoComplete="current-password" name="password" placeholder="Your password" required type="password" />
          </label>
          <button className="button" type="submit">
            <GraduationCap size={18} aria-hidden="true" />
            Sign in
          </button>
          <div className="inline-actions">
            <Link href="/register">Create account</Link>
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
