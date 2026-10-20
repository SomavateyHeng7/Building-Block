import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function memoryStorage(blocked = false) {
  const data = new Map<string, string>();
  const fail = () => {
    throw new Error("blocked");
  };
  return {
    getItem: blocked ? fail : (key: string) => data.get(key) ?? null,
    setItem: blocked ? fail : (key: string, value: string) => void data.set(key, value),
    removeItem: blocked ? fail : (key: string) => void data.delete(key),
  };
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("privacy consent", () => {
  it("is needed until accepted, then remembered with the version and time", async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    const consent = await import("@/lib/consent");
    expect(consent.hasConsent()).toBe(false);
    consent.acceptConsent(new Date("2026-10-20T09:00:00Z"));
    expect(consent.hasConsent()).toBe(true);
    expect(consent.readConsent()).toEqual({ version: consent.PRIVACY_VERSION, acceptedAt: "2026-10-20T09:00:00.000Z" });
  });

  it("asks again when the notice has changed since it was accepted", async () => {
    const storage = memoryStorage();
    storage.setItem("bb:consent", JSON.stringify({ version: "2020-01-01", acceptedAt: "2020-01-01T00:00:00Z" }));
    vi.stubGlobal("window", { localStorage: storage });
    const consent = await import("@/lib/consent");
    expect(consent.hasConsent()).toBe(false);
  });

  it("can be withdrawn", async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    const consent = await import("@/lib/consent");
    consent.acceptConsent();
    consent.withdrawConsent();
    expect(consent.hasConsent()).toBe(false);
  });

  it("lasts for the session when storage is blocked", async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage(true) });
    const consent = await import("@/lib/consent");
    expect(consent.hasConsent()).toBe(false);
    consent.acceptConsent();
    expect(consent.hasConsent()).toBe(true);
  });
});
