import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

describe("maintenance proxy", () => {
  it("answers 503 on /maintenance itself, so the page's 'are we back?' check doesn't reload it", () => {
    vi.stubEnv("MAINTENANCE_MODE", "on");
    for (const path of ["/maintenance", "/editor"]) {
      const response = proxy(new NextRequest(`http://localhost${path}`));
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBeTruthy();
    }
  });

  it("sends visitors on /maintenance home once maintenance is over", () => {
    const response = proxy(new NextRequest("http://localhost/maintenance"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });
});
