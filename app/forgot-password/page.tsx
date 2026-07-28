import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { getCsrfToken } from "@/lib/auth/csrf";

export default async function ForgotPasswordPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";
  const csrfToken = await getCsrfToken();

  return (
    <main className="main" style={{ maxWidth: 820 }}>
      <section className="card" style={{ marginTop: 64 }}>
        <p className="eyebrow">Account recovery</p>
        <h1>Reset password</h1>
        {error ? <p className="notice error">{error}</p> : null}
        {success ? <p className="notice success">{success}</p> : null}
        <form action={requestPasswordResetAction} className="grid" style={{ marginTop: 24 }}>
          <input name="csrf_token" type="hidden" value={csrfToken} />
          <label className="grid">
            <span>Email</span>
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <button className="button" type="submit">Prepare reset link</button>
          <Link className="muted" href="/login">Back to sign in</Link>
        </form>
      </section>
    </main>
  );
}
