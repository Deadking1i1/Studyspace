import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
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
    <AuthShell
      description="Pick up where you left off and make progress on what matters today."
      eyebrow="Study Space account"
      title="Welcome back"
    >
        {error ? <p className="notice error">{error}</p> : null}
        {success ? <p className="notice success">{success}</p> : null}

        <form action={loginAction} className="auth-form">
          <input name="csrf_token" type="hidden" value={csrfToken} />
          <label>
            <span>Email</span>
            <input autoComplete="email" name="email" placeholder="you@example.com" required type="email" />
          </label>
          <label>
            <span className="auth-label-row"><span>Password</span><Link href="/forgot-password">Forgot password?</Link></span>
            <input autoComplete="current-password" name="password" placeholder="Your password" required type="password" />
          </label>
          <button className="button auth-submit" type="submit">
            <GraduationCap size={18} aria-hidden="true" />
            Sign in
          </button>
          <p className="auth-switch">New to Study Space? <Link href="/register">Create an account</Link></p>
        </form>
    </AuthShell>
  );
}
