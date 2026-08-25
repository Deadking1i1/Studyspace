import { describe, expect, it } from "vitest";
import { boundedInteger, daysBetween, scoreStudyRecommendation } from "@/lib/features/academic";

describe("academic autopilot recommendation scoring", () => {
  it("normalizes bounded integer form values without leaking NaN to PostgreSQL", () => {
    expect(boundedInteger("75", 80, 50, 100)).toBe(75);
    expect(boundedInteger("invalid", 80, 50, 100)).toBe(80);
    expect(boundedInteger("60.5", 60, 15, 720)).toBe(60);
    expect(boundedInteger("999", 60, 15, 720)).toBe(720);
  });
  it("normalizes PostgreSQL aggregate timestamp strings", () => {
    expect(daysBetween("2026-08-10T16:30:00.000Z", new Date("2026-08-13T09:00:00.000Z"))).toBe(3);
  });

  it("prioritizes urgent deadlines with weak mastery", () => {
    const recommendation = scoreStudyRecommendation({
      today: new Date("2026-08-13T00:00:00Z"),
      deadlineDays: 1,
      deadlineWeight: 5,
      estimatedMinutes: 75,
      topicMastery: 35,
      lastStudiedDaysAgo: 10,
      materialCount: 2,
      noteCount: 3,
      openTaskCount: 2,
      flashcardCount: 4,
    });

    expect(recommendation.urgencyLabel).toBe("high");
    expect(recommendation.score).toBeGreaterThanOrEqual(70);
    expect(recommendation.suggestedMinutes).toBe(75);
    expect(recommendation.reason).toContain("deadline");
  });

  it("keeps low-signal subjects low priority but still actionable", () => {
    const recommendation = scoreStudyRecommendation({
      today: new Date("2026-08-13T00:00:00Z"),
      deadlineDays: null,
      deadlineWeight: 1,
      estimatedMinutes: 0,
      topicMastery: null,
      lastStudiedDaysAgo: null,
      materialCount: 0,
      noteCount: 0,
      openTaskCount: 0,
      flashcardCount: 0,
    });

    expect(recommendation.urgencyLabel).toBe("low");
    expect(recommendation.suggestedMinutes).toBe(30);
    expect(recommendation.reason).toContain("not been studied");
  });
});
