import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
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
    <AuthShell
      description="Enter your account email and we will prepare a secure recovery link."
      eyebrow="Account recovery"
      title="Reset your password"
    >
        {error ? <p className="notice error">{error}</p> : null}
        {success ? <p className="notice success">{success}</p> : null}
        <form action={requestPasswordResetAction} className="auth-form">
          <input name="csrf_token" type="hidden" value={csrfToken} />
          <label>
            <span>Email</span>
            <input autoComplete="email" name="email" placeholder="you@example.com" required type="email" />
          </label>
          <button className="button auth-submit" type="submit">Prepare reset link</button>
          <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
        </form>
    </AuthShell>
  );
}
