import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  STUDY_SPACE_DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://study_space:study_space@localhost:5432/study_space"),
  AUTH_SECRET: z.string().min(32).default("development-only-change-before-production"),
  STUDY_SPACE_APP_BASE_URL: z.string().url().default("http://127.0.0.1:3000"),
  AUTH_REGISTER_RATE_LIMIT: z.string().default("30 per minute"),
  AUTH_LOGIN_RATE_LIMIT: z.string().default("30 per minute"),
  AUTH_PASSWORD_RESET_RATE_LIMIT: z.string().default("20 per minute"),
  SPOTIFY_CLIENT_ID: z.string().optional().default(""),
  SPOTIFY_CLIENT_SECRET: z.string().optional().default(""),
  SPOTIFY_REDIRECT_URI: z.string().optional().default("http://127.0.0.1:3000/integrations/spotify/callback"),
});

const parsed = envSchema.parse(process.env);

const unsafeAuthSecrets = new Set([
  "development-only-change-before-production",
  "replace-with-a-secure-random-string-for-next",
  "replace-with-a-secure-random-string",
  "dev-secret",
]);

if (parsed.NODE_ENV === "production" && unsafeAuthSecrets.has(parsed.AUTH_SECRET)) {
  throw new Error("AUTH_SECRET must be replaced before production.");
}

export const env = parsed;
