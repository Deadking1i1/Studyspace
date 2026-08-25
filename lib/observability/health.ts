import { sql } from "drizzle-orm";
import { db } from "@/db";
import { withTimeout } from "@/lib/resilience/timeout";

export type DependencyStatus = "up" | "down";
export type ReadinessResult = { ready: boolean; checks: { database: DependencyStatus } };

export async function checkReadiness(): Promise<ReadinessResult> {
  try {
    const pingDatabase = async () => {
      await db.execute(sql`select 1`);
    };
    await withTimeout(pingDatabase(), 2_000, "database");
    return { ready: true, checks: { database: "up" } };
  } catch {
    return { ready: false, checks: { database: "down" } };
  }
}
