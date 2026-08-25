import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import postgres from "postgres";

const databaseUrl = process.env.STUDY_SPACE_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("STUDY_SPACE_DATABASE_URL is required.");
}

const client = postgres(databaseUrl, { max: 1 });
try {
  await migrate(drizzle(client), {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  process.stdout.write("Committed Drizzle migrations applied successfully.\n");
} finally {
  await client.end();
}
