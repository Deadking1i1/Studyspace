import { confirmEmailChangeAction } from "@/lib/auth/actions";
import { getCsrfToken } from "@/lib/auth/csrf";

export default async function ConfirmEmailChangePage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  const csrfToken = await getCsrfToken();

  async function action(formData: FormData) {
    "use server";
    await confirmEmailChangeAction(token, formData);
  }

  return (
    <main className="main" style={{ maxWidth: 820 }}>
      <section className="card" style={{ marginTop: 64 }}>
        <p className="eyebrow">Email change</p>
        <h1>Confirm new email</h1>
        <p className="muted">This will replace the email address on your Study Space account.</p>
        <form action={action}>
          <input name="csrf_token" type="hidden" value={csrfToken} />
          <button className="button" type="submit">Confirm email change</button>
        </form>
      </section>
    </main>
  );
}
