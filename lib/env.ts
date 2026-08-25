import { z } from "zod";

const optionalUrl = z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  STUDY_SPACE_DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://study_space:study_space@localhost:5432/study_space"),
  AUTH_SECRET: z.string().min(32).default("development-only-change-before-production"),
  STUDY_SPACE_APP_BASE_URL: z.string().url().default("http://127.0.0.1:3000"),
  AUTH_REGISTER_RATE_LIMIT: z.string().default("3 per minute"),
  AUTH_LOGIN_RATE_LIMIT: z.string().default("5 per minute"),
  AUTH_PASSWORD_RESET_RATE_LIMIT: z.string().default("3 per minute"),
  TRUST_PROXY_HEADERS: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default(""),
  UPLOAD_SCANNER_URL: optionalUrl,
  UPLOAD_SCANNER_TOKEN: z.string().optional().default(""),
  STORAGE_BACKEND: z.enum(["local", "s3"]).default("local"),
  STORAGE_BUCKET: z.string().optional().default(""),
  STORAGE_REGION: z.string().optional().default("auto"),
  STORAGE_ENDPOINT_URL: optionalUrl,
  STORAGE_ACCESS_KEY_ID: z.string().optional().default(""),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional().default(""),
  STORAGE_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  PRIVATE_BETA_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  BETA_ALLOWED_EMAILS: z.string().optional().default(""),
  SPOTIFY_CLIENT_ID: z.string().optional().default(""),
  SPOTIFY_CLIENT_SECRET: z.string().optional().default(""),
  SPOTIFY_REDIRECT_URI: z.string().optional().default("http://127.0.0.1:3000/integrations/spotify/callback"),
  SPOTIFY_ENABLED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
});

const parsed = envSchema.parse(process.env);

const unsafeAuthSecrets = new Set([
  "development-only-change-before-production",
  "replace-with-a-secure-random-string-for-next",
  "replace-with-a-secure-random-string",
  "dev-secret",
]);

export function assertProductionEnvironment() {
  if (parsed.NODE_ENV !== "production") return;
  if (unsafeAuthSecrets.has(parsed.AUTH_SECRET)) {
    throw new Error("AUTH_SECRET must be replaced before production.");
  }
  if (!parsed.STUDY_SPACE_APP_BASE_URL.startsWith("https://")) {
    throw new Error("STUDY_SPACE_APP_BASE_URL must use HTTPS in production.");
  }
  if (parsed.EMAIL_PROVIDER !== "resend" || !parsed.RESEND_API_KEY || !parsed.EMAIL_FROM) {
    throw new Error("Production requires EMAIL_PROVIDER=resend, RESEND_API_KEY and EMAIL_FROM.");
  }
  if (!parsed.UPLOAD_SCANNER_URL || !parsed.UPLOAD_SCANNER_TOKEN) {
    throw new Error("Production requires UPLOAD_SCANNER_URL and UPLOAD_SCANNER_TOKEN.");
  }
  if (parsed.STORAGE_BACKEND !== "s3" || !parsed.STORAGE_BUCKET || !parsed.STORAGE_ACCESS_KEY_ID || !parsed.STORAGE_SECRET_ACCESS_KEY) {
    throw new Error("Production requires private S3-compatible object storage configuration.");
  }
  if (!parsed.PRIVATE_BETA_ENABLED || !parsed.BETA_ALLOWED_EMAILS.trim()) {
    throw new Error("Production private beta requires PRIVATE_BETA_ENABLED=true and BETA_ALLOWED_EMAILS.");
  }
  if (parsed.SPOTIFY_ENABLED && (!parsed.SPOTIFY_CLIENT_ID || !parsed.SPOTIFY_CLIENT_SECRET || !parsed.SPOTIFY_REDIRECT_URI.startsWith("https://"))) {
    throw new Error("Enabled production Spotify integration requires server-side credentials and an HTTPS callback.");
  }
}

export const env = parsed;
