import { ShieldCheck } from "lucide-react";
import { verifyEmailAction } from "@/lib/auth/actions";
import { getCsrfToken } from "@/lib/auth/csrf";

export default async function VerifyEmailPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  const csrfToken = await getCsrfToken();

  async function action(formData: FormData) {
    "use server";
    await verifyEmailAction(token, formData);
  }

  return (
    <main className="main" style={{ maxWidth: 820 }}>
      <section className="card" style={{ marginTop: 64 }}>
        <p className="eyebrow">Email verification</p>
        <h1>Verify your email</h1>
        <p className="muted">Confirm this address for account recovery and security notifications.</p>
        <form action={action}>
          <input name="csrf_token" type="hidden" value={csrfToken} />
          <button className="button" type="submit">
            <ShieldCheck size={18} aria-hidden="true" />
            Verify email
          </button>
        </form>
      </section>
    </main>
  );
}
