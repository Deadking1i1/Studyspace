import { env } from "@/lib/env";

type AccountEmail = { to: string; subject: string; text: string };

const ACCOUNT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidAccountEmail(email: string) {
  return email.length <= 255 && ACCOUNT_EMAIL_PATTERN.test(email);
}

export function accountLink(path: string, token: string) {
  return new URL(`${path}/${encodeURIComponent(token)}`, env.STUDY_SPACE_APP_BASE_URL).toString();
}

export function developmentLink(path: string, token: string) {
  return env.NODE_ENV === "production" ? null : accountLink(path, token);
}

export async function sendAccountEmail(message: AccountEmail) {
  if (env.EMAIL_PROVIDER === "console") {
    if (env.NODE_ENV === "production") throw new Error("Console email delivery is disabled in production.");
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Email provider rejected the request (${response.status}).`);
}

export async function sendVerificationEmail(to: string, token: string) {
  const link = accountLink("/verify-email", token);
  await sendAccountEmail({ to, subject: "Verify your Study Space email", text: `Verify your email: ${link}\n\nThis link expires in 48 hours.` });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = accountLink("/reset-password", token);
  await sendAccountEmail({ to, subject: "Reset your Study Space password", text: `Reset your password: ${link}\n\nThis link expires in 2 hours. If you did not request this, ignore this email.` });
}

export async function sendEmailChangeEmail(to: string, token: string) {
  const link = accountLink("/settings/confirm-email-change", token);
  await sendAccountEmail({ to, subject: "Confirm your Study Space email change", text: `Confirm your new email: ${link}\n\nThis link expires in 24 hours.` });
}
