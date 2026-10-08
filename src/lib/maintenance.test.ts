import { describe, expect, it } from "vitest";
import { DEFAULT_RETRY_AFTER_SECONDS, readMaintenanceConfig, retryAfterSeconds, upcomingEnd } from "./maintenance";

describe("readMaintenanceConfig", () => {
  it("is off unless MAINTENANCE_MODE says on", () => {
    expect(readMaintenanceConfig({}).enabled).toBe(false);
    expect(readMaintenanceConfig({ MAINTENANCE_MODE: "off" }).enabled).toBe(false);
    expect(readMaintenanceConfig({ MAINTENANCE_MODE: "0" }).enabled).toBe(false);
    for (const value of ["on", "ON", "true", "1", "yes", " on "]) {
      expect(readMaintenanceConfig({ MAINTENANCE_MODE: value }).enabled).toBe(true);
    }
  });

  it("keeps a valid end time and drops an invalid one", () => {
    expect(readMaintenanceConfig({ MAINTENANCE_UNTIL: "2026-10-08T18:00:00Z" }).until).toBe("2026-10-08T18:00:00.000Z");
    expect(readMaintenanceConfig({ MAINTENANCE_UNTIL: "soon" }).until).toBeNull();
  });

  it("treats blank message and token as unset", () => {
    const config = readMaintenanceConfig({ MAINTENANCE_MESSAGE: "  ", MAINTENANCE_BYPASS_TOKEN: "" });
    expect(config.message).toBeNull();
    expect(config.bypassToken).toBeNull();
  });
});

describe("retryAfterSeconds", () => {
  const now = Date.parse("2026-10-08T17:00:00Z");

  it("counts down to the expected end", () => {
    const config = readMaintenanceConfig({ MAINTENANCE_UNTIL: "2026-10-08T17:30:00Z" });
    expect(retryAfterSeconds(config, now)).toBe(1800);
  });

  it("falls back to the default when the end is unset or past", () => {
    expect(retryAfterSeconds(readMaintenanceConfig({}), now)).toBe(DEFAULT_RETRY_AFTER_SECONDS);
    const past = readMaintenanceConfig({ MAINTENANCE_UNTIL: "2026-10-08T16:00:00Z" });
    expect(retryAfterSeconds(past, now)).toBe(DEFAULT_RETRY_AFTER_SECONDS);
  });
});

describe("upcomingEnd", () => {
  const now = Date.parse("2026-10-08T17:00:00Z");

  it("shows only an end time that's still ahead", () => {
    expect(upcomingEnd(readMaintenanceConfig({ MAINTENANCE_UNTIL: "2026-10-08T18:00:00Z" }), now)).toBe("2026-10-08T18:00:00.000Z");
    expect(upcomingEnd(readMaintenanceConfig({ MAINTENANCE_UNTIL: "2026-10-08T16:00:00Z" }), now)).toBeNull();
    expect(upcomingEnd(readMaintenanceConfig({}), now)).toBeNull();
  });
});
