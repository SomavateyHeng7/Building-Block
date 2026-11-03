import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function memoryStorage(blocked = false, initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [["bb:recent-templates", initial]]);
  const fail = () => {
    throw new Error("blocked");
  };
  return {
    getItem: blocked ? fail : (key: string) => data.get(key) ?? null,
    setItem: blocked ? fail : (key: string, value: string) => void data.set(key, value),
    removeItem: blocked ? fail : (key: string) => void data.delete(key),
  };
}

const stubWindow = (storage: ReturnType<typeof memoryStorage>) =>
  vi.stubGlobal("window", { localStorage: storage, addEventListener() {}, removeEventListener() {} });

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("recently used templates", () => {
  it("starts empty and keeps the newest first, without repeats, at most three", async () => {
    stubWindow(memoryStorage());
    const recent = await import("@/lib/recentTemplates");
    expect(recent.readRecentTemplates()).toEqual([]);
    for (const id of ["a", "b", "c", "a", "d"]) recent.recordRecentTemplate(id);
    expect(recent.readRecentTemplates()).toEqual(["d", "a", "c"]);
  });

  it("returns the same array until something changes", async () => {
    stubWindow(memoryStorage(false, '["x","y"]'));
    const recent = await import("@/lib/recentTemplates");
    expect(recent.readRecentTemplates()).toBe(recent.readRecentTemplates());
  });

  it("ignores damaged stored values", async () => {
    stubWindow(memoryStorage(false, '{"not":"a list"}'));
    expect((await import("@/lib/recentTemplates")).readRecentTemplates()).toEqual([]);
    vi.resetModules();
    stubWindow(memoryStorage(false, '["ok", 4, null, "fine"]'));
    expect((await import("@/lib/recentTemplates")).readRecentTemplates()).toEqual(["ok", "fine"]);
  });

  it("lasts for the tab when storage is blocked, and can be cleared", async () => {
    stubWindow(memoryStorage(true));
    const recent = await import("@/lib/recentTemplates");
    recent.recordRecentTemplate("a");
    expect(recent.readRecentTemplates()).toEqual(["a"]);
    recent.clearRecentTemplates();
    expect(recent.readRecentTemplates()).toEqual([]);
  });
});
