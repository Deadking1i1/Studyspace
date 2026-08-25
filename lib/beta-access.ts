import { env } from "@/lib/env";

export function betaAllowedEmails(value = env.BETA_ALLOWED_EMAILS) {
  return new Set(value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function canRegisterForBeta(email: string) {
  if (!env.PRIVATE_BETA_ENABLED) return env.NODE_ENV !== "production";
  return betaAllowedEmails().has(email.trim().toLowerCase());
}
