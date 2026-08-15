import Link from "next/link";
import { UserPlus } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
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
    <AuthShell
      description="Set up your student workspace and start organizing what matters."
      eyebrow="Start studying"
      title="Create your account"
    >
        {error ? <p className="notice error">{error}</p> : null}
        {success ? <p className="notice success">{success}</p> : null}

        <form action={registerAction} className="auth-form">
          <input name="csrf_token" type="hidden" value={csrfToken} />
          <label>
            <span>Username</span>
            <input autoComplete="username" maxLength={128} name="username" placeholder="What should we call you?" required />
          </label>
          <label>
            <span>Email</span>
            <input autoComplete="email" name="email" placeholder="you@example.com" required type="email" />
          </label>
          <div className="auth-field-row">
          <label>
            <span>Password</span>
            <input autoComplete="new-password" minLength={8} name="password" placeholder="At least 8 characters" required type="password" />
          </label>
          <label>
            <span>Confirm password</span>
            <input autoComplete="new-password" minLength={8} name="confirm_password" placeholder="Repeat your password" required type="password" />
          </label>
          </div>
          <p className="auth-password-hint">Use 8+ characters with uppercase, lowercase, a number, and a symbol.</p>
          <button className="button auth-submit" type="submit">
            <UserPlus size={18} aria-hidden="true" />
            Create account
          </button>
          <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
        </form>
    </AuthShell>
  );
}
