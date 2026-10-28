import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

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

describe("content security policy", () => {
  const nonceOf = (response: Response) => /'nonce-([^']+)'/.exec(response.headers.get("Content-Security-Policy") ?? "")?.[1];

  it("gives every page a fresh nonce, and hands the same one to the page", () => {
    const first = proxy(new NextRequest("http://localhost/editor"));
    const second = proxy(new NextRequest("http://localhost/editor"));
    expect(nonceOf(first)).toBeTruthy();
    expect(nonceOf(first)).not.toBe(nonceOf(second));
    // NextResponse.next({ request }) passes request headers on as x-middleware-request-*.
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonceOf(first));
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(first.headers.get("Content-Security-Policy"));
  });

  it("covers the maintenance page too", () => {
    vi.stubEnv("MAINTENANCE_MODE", "on");
    const response = proxy(new NextRequest("http://localhost/editor"));
    expect(response.status).toBe(503);
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonceOf(response));
  });
});
