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
    const recent = await import("@/lib/editor/recentTemplates");
    expect(recent.readRecentTemplates()).toEqual([]);
    for (const id of ["a", "b", "c", "a", "d"]) recent.recordRecentTemplate(id);
    expect(recent.readRecentTemplates()).toEqual(["d", "a", "c"]);
  });

  it("returns the same array until something changes", async () => {
    stubWindow(memoryStorage(false, '["x","y"]'));
    const recent = await import("@/lib/editor/recentTemplates");
    expect(recent.readRecentTemplates()).toBe(recent.readRecentTemplates());
  });

  it("ignores damaged stored values", async () => {
    stubWindow(memoryStorage(false, '{"not":"a list"}'));
    expect((await import("@/lib/editor/recentTemplates")).readRecentTemplates()).toEqual([]);
    vi.resetModules();
    stubWindow(memoryStorage(false, '["ok", 4, null, "fine"]'));
    expect((await import("@/lib/editor/recentTemplates")).readRecentTemplates()).toEqual(["ok", "fine"]);
  });

  it("lasts for the tab when storage is blocked, and can be cleared", async () => {
    stubWindow(memoryStorage(true));
    const recent = await import("@/lib/editor/recentTemplates");
    recent.recordRecentTemplate("a");
    expect(recent.readRecentTemplates()).toEqual(["a"]);
    recent.clearRecentTemplates();
    expect(recent.readRecentTemplates()).toEqual([]);
  });
});

describe("recentFirst", () => {
  const items = ["a", "b", "c", "d"].map((id) => ({ id }));

  it("puts recent ones first in their own order, then the rest as before", async () => {
    const { recentFirst } = await import("@/lib/editor/recentTemplates");
    expect(recentFirst(items, ["c", "a"]).map((item) => item.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("ignores ids that aren't there and changes nothing without any", async () => {
    const { recentFirst } = await import("@/lib/editor/recentTemplates");
    expect(recentFirst(items, ["zzz"])).toEqual(items);
    expect(recentFirst(items, [])).toEqual(items);
  });
});

describe("pruneRecentTemplates", () => {
  it("drops ids that aren't templates any more and keeps the order of the rest", async () => {
    stubWindow(memoryStorage(false, '["gone","b","old"]'));
    const recent = await import("@/lib/editor/recentTemplates");
    recent.pruneRecentTemplates(["a", "b"]);
    expect(recent.readRecentTemplates()).toEqual(["b"]);
  });

  it("clears the list when nothing is left, and leaves a valid list alone", async () => {
    stubWindow(memoryStorage(false, '["x","y"]'));
    const recent = await import("@/lib/editor/recentTemplates");
    const before = recent.readRecentTemplates();
    recent.pruneRecentTemplates(["x", "y"]);
    expect(recent.readRecentTemplates()).toBe(before);
    recent.pruneRecentTemplates(["z"]);
    expect(recent.readRecentTemplates()).toEqual([]);
  });

  it("keeps moving the newest to the top when storage can be read but refuses writes", async () => {
    const storage = memoryStorage(false, JSON.stringify(["a", "b"]));
    storage.setItem = () => {
      throw new Error("quota");
    };
    stubWindow(storage);
    const recent = await import("@/lib/editor/recentTemplates");
    expect(recent.readRecentTemplates()).toEqual(["a", "b"]);
    recent.recordRecentTemplate("c");
    expect(recent.readRecentTemplates()).toEqual(["c", "a", "b"]);
    recent.recordRecentTemplate("b");
    expect(recent.readRecentTemplates()).toEqual(["b", "c", "a"]);
  });
});
