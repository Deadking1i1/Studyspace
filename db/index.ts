import postgres from "postgres";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { env } from "@/lib/env";
import * as schema from "./schema";

const databaseUrl = env.STUDY_SPACE_DATABASE_URL;

// The application relies on interactive transactions for account deletion and
// multi-row feature writes. Drizzle's neon-http adapter does not support them;
// postgres-js works with local PostgreSQL and Neon pooled/direct URLs.
export const db = drizzlePostgres(postgres(databaseUrl, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
}), { schema });

export { schema };
