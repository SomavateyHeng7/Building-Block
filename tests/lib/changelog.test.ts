import { describe, expect, it } from "vitest";
import { CHANGELOG } from "@/lib/changelog";
import { limitNotice } from "@/lib/plans";

describe("changelog", () => {
  it("is newest first, with real dates and something to say", () => {
    const dates = CHANGELOG.map((entry) => entry.date);
    expect(dates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)))).toBe(true);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const entry of CHANGELOG) {
      expect(entry.title.trim()).not.toBe("");
      expect(entry.changes.length).toBeGreaterThan(0);
      expect(entry.changes.every((change) => change.trim().endsWith("."))).toBe(true);
    }
  });
});

describe("limitNotice", () => {
  const check = (used: number, over: boolean, blocked = false) => ({ used, limit: 100, over, blocked });

  it("stays quiet until the limit is near, and when there isn't one", () => {
    expect(limitNotice(check(79, false))).toBeNull();
    expect(limitNotice({ used: 500, over: false, blocked: false })).toBeNull();
  });

  it("says how much is used when close, and is honest that going over isn't blocked yet", () => {
    expect(limitNotice(check(80, false))).toBe("80 of 100 lines (Free plan).");
    expect(limitNotice(check(120, true))).toBe("120 lines. The Free plan includes 100; nothing is blocked yet.");
    expect(limitNotice(check(120, true, true))).toBe("120 of 100 lines. The Free plan allows 100.");
  });
});
