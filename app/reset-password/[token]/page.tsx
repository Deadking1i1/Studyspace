import { resetPasswordAction } from "@/lib/auth/actions";
import { getCsrfToken } from "@/lib/auth/csrf";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { token } = await params;
  const query = (await searchParams) ?? {};
  const error = typeof query.error === "string" ? query.error : "";
  const csrfToken = await getCsrfToken();

  async function action(formData: FormData) {
    "use server";
    await resetPasswordAction(token, formData);
  }

  return (
    <main className="main" style={{ maxWidth: 820 }}>
      <section className="card" style={{ marginTop: 64 }}>
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password</h1>
        {error ? <p className="notice error">{error}</p> : null}
        <form action={action} className="grid" style={{ marginTop: 24 }}>
          <input name="csrf_token" type="hidden" value={csrfToken} />
          <label className="grid">
            <span>New password</span>
            <input autoComplete="new-password" minLength={8} name="password" required type="password" />
          </label>
          <label className="grid">
            <span>Confirm password</span>
            <input autoComplete="new-password" minLength={8} name="confirm_password" required type="password" />
          </label>
          <button className="button" type="submit">Update password</button>
        </form>
      </section>
    </main>
  );
}
