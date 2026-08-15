import Image from "next/image";
import Link from "next/link";
import { BookOpenCheck, CalendarCheck2, CloudUpload, ShieldCheck } from "lucide-react";

type AuthShellProps = Readonly<{
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}>;

const benefits = [
  { icon: BookOpenCheck, label: "Keep every subject in one calm workspace" },
  { icon: CalendarCheck2, label: "Turn deadlines into a clear study plan" },
  { icon: CloudUpload, label: "Bring notes and study material together" },
];

export function AuthShell({ children, eyebrow, title, description }: AuthShellProps) {
  return (
    <main className="auth-shell">
      <section className="auth-brand-panel" aria-label="Study Space introduction">
        <Link className="auth-brand" href="/">
          <Image alt="" height={76} priority src="/assets/study-space-logo.png" width={76} />
          <span>
            <strong>Study Space</strong>
            <small>Focus. Learn. Achieve.</small>
          </span>
        </Link>

        <div className="auth-brand-copy">
          <p className="eyebrow">Your student command center</p>
          <h2>Make your next study session count.</h2>
          <p>Plan your work, organize your knowledge, and stay focused without bouncing between a dozen tools.</p>
        </div>

        <ul className="auth-benefits">
          {benefits.map(({ icon: Icon, label }) => (
            <li key={label}>
              <Icon aria-hidden="true" size={20} />
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <div className="auth-trust">
          <ShieldCheck aria-hidden="true" size={18} />
          <span>Your account and study history stay private by default.</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-brand">
          <Image alt="" height={48} priority src="/assets/study-space-logo.png" width={48} />
          <strong>Study Space</strong>
        </div>
        <div className="auth-form-wrap">
          <header className="auth-form-header">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {children}
        </div>
      </section>
    </main>
  );
}
