import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import postgres from "postgres";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { env } from "@/lib/env";
import * as schema from "./schema";

const databaseUrl = env.STUDY_SPACE_DATABASE_URL;
const isNeon = databaseUrl.includes("neon.tech");

export const db = isNeon
  ? drizzleNeon(neon(databaseUrl), { schema })
  : drizzlePostgres(postgres(databaseUrl, { max: 1 }), { schema });

export { schema };
