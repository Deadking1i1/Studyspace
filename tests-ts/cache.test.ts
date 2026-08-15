import { describe, expect, it } from "vitest";
import { cachedByUser, invalidateUserCache } from "@/lib/cache";

describe("user scoped memory cache", () => {
  it("caches values per user", async () => {
    let calls = 0;
    const first = await cachedByUser("dashboard", 1, 60, async () => {
      calls += 1;
      return "user-1";
    });
    const second = await cachedByUser("dashboard", 1, 60, async () => {
      calls += 1;
      return "fresh";
    });
    const otherUser = await cachedByUser("dashboard", 2, 60, async () => {
      calls += 1;
      return "user-2";
    });

    expect(first).toBe("user-1");
    expect(second).toBe("user-1");
    expect(otherUser).toBe("user-2");
    expect(calls).toBe(2);
  });

  it("invalidates only matching user keys", async () => {
    await cachedByUser("autopilot", 11, 60, async () => "old");
    await cachedByUser("autopilot", 12, 60, async () => "other");
    invalidateUserCache(11, "autopilot");
    const refreshed = await cachedByUser("autopilot", 11, 60, async () => "new");
    const untouched = await cachedByUser("autopilot", 12, 60, async () => "changed");

    expect(refreshed).toBe("new");
    expect(untouched).toBe("other");
  });
});
