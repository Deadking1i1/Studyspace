import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("core feature data integrity", () => {
  it("uses a PostgreSQL adapter that supports interactive transactions", () => {
    const database = source("db/index.ts");
    expect(database).toContain("drizzlePostgres");
    expect(database).not.toContain("drizzleNeon");
  });

  it("creates paired flashcard and group records transactionally", () => {
    expect(source("lib/features/flashcards.ts")).toContain("await db.transaction");
    expect(source("lib/features/community.ts")).toContain("await db.transaction");
  });

  it("validates deadline academic links through the owner-scoped selector", () => {
    const academic = source("lib/features/academic.ts");
    expect(academic).toContain('ownedAcademicSelection(user.id, formData.get("subject_id"), formData.get("topic_id"))');
    expect(academic).toContain("subjectId: academic.subjectId");
    expect(academic).toContain("topicId: academic.topicId");
  });

  it("keeps ownership predicates on final core-record mutations", () => {
    expect(source("lib/features/notes.ts")).toContain("eq(notes.userId, user.id)");
    expect(source("lib/features/tasks.ts")).toContain("eq(tasks.userId, user.id)");
    expect(source("lib/features/calendar.ts")).toContain("eq(events.userId, user.id)");
    expect(source("lib/features/flashcards.ts")).toContain("eq(flashcards.userId, user.id)");
  });
});
