import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankDiagram } from "@/lib/diagram/factory";

function memoryStorage({ blocked = false, full = false } = {}) {
  const data = new Map<string, string>();
  const fail = () => {
    throw new Error("blocked");
  };
  return {
    data,
    getItem: blocked ? fail : (key: string) => data.get(key) ?? null,
    setItem:
      blocked || full
        ? (key: string, value: string) => {
            if (blocked || key === "bb:recovery:copy") throw new Error("QuotaExceededError");
            data.set(key, value);
          }
        : (key: string, value: string) => void data.set(key, value),
    removeItem: blocked ? fail : (key: string) => void data.delete(key),
  };
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("recovery copies", () => {
  it("are off by default and keep nothing", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    const recovery = await import("@/lib/diagram/recovery");
    expect(recovery.isRecoveryEnabled()).toBe(false);
    expect(recovery.writeRecoveryCopy(createBlankDiagram("Plan"), null)).toBe(false);
    expect(storage.data.size).toBe(0);
    expect(recovery.readRecoveryCopy()).toBeNull();
  });

  it("keep the diagram and read it back, checked like a file", async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    const recovery = await import("@/lib/diagram/recovery");
    recovery.setRecoveryEnabled(true);
    const diagram = createBlankDiagram("Plan");
    expect(recovery.writeRecoveryCopy(diagram, "plan.json", new Date("2026-10-20T09:00:00Z"))).toBe(true);
    const copy = recovery.readRecoveryCopy();
    expect(copy?.diagram.id).toBe(diagram.id);
    expect(copy?.diagram.name).toBe("Plan");
    expect(copy?.fileName).toBe("plan.json");
    expect(copy?.keptAt).toBe("2026-10-20T09:00:00.000Z");
  });

  it("ignore a copy that isn't a diagram", async () => {
    const storage = memoryStorage();
    storage.setItem("bb:recovery:copy", JSON.stringify({ diagram: { nope: true } }));
    vi.stubGlobal("window", { localStorage: storage });
    const recovery = await import("@/lib/diagram/recovery");
    expect(recovery.readRecoveryCopy()).toBeNull();
  });

  it("clear only the copy of the given diagram", async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    const recovery = await import("@/lib/diagram/recovery");
    recovery.setRecoveryEnabled(true);
    const kept = createBlankDiagram("Kept");
    recovery.writeRecoveryCopy(kept, null);
    recovery.clearRecoveryCopy(createBlankDiagram("Other").id);
    expect(recovery.readRecoveryCopy()?.diagram.id).toBe(kept.id);
    recovery.clearRecoveryCopy(kept.id);
    expect(recovery.readRecoveryCopy()).toBeNull();
  });

  it("delete the copy when turned off, and tell listeners", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    const recovery = await import("@/lib/diagram/recovery");
    const listener = vi.fn();
    recovery.subscribeRecovery(listener);
    recovery.setRecoveryEnabled(true);
    recovery.writeRecoveryCopy(createBlankDiagram(), null);
    recovery.setRecoveryEnabled(false);
    expect(storage.data.size).toBe(0);
    expect(listener).toHaveBeenCalled();
  });

  it("report a full or blocked browser storage instead of throwing", async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage({ full: true }) });
    let recovery = await import("@/lib/diagram/recovery");
    recovery.setRecoveryEnabled(true);
    expect(recovery.writeRecoveryCopy(createBlankDiagram(), null)).toBe(false);

    vi.resetModules();
    vi.stubGlobal("window", { localStorage: memoryStorage({ blocked: true }) });
    recovery = await import("@/lib/diagram/recovery");
    recovery.setRecoveryEnabled(true);
    expect(recovery.isRecoveryEnabled()).toBe(false);
    expect(recovery.readRecoveryCopy()).toBeNull();
  });
});
