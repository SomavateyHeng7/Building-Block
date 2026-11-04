import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "@/lib/csp";

const directives = (policy: string) => new Map(policy.split("; ").map((part) => [part.split(" ")[0], part.split(" ").slice(1).join(" ")]));

describe("content security policy", () => {
  it("runs only scripts with the nonce (and what they load), and blocks plugins, framing and other sites", () => {
    const policy = directives(contentSecurityPolicy({ nonce: "abc123" }));
    expect(policy.get("script-src")).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(policy.get("default-src")).toBe("'self'");
    expect(policy.get("object-src")).toBe("'none'");
    expect(policy.get("frame-ancestors")).toBe("'none'");
    // blob: so a page can read back a file it made (the browser tests check downloads with fetch).
    expect(policy.get("connect-src")).toBe("'self' blob:");
    // Exports draw through data: and blob: images, and point <base> at the stylesheet to embed fonts.
    expect(policy.get("img-src")).toBe("'self' data: blob:");
    expect(policy.get("base-uri")).toBe("'self'");
    expect(policy.has("upgrade-insecure-requests")).toBe(false);
  });

  it("allows eval only in development, and upgrades http:// requests only over HTTPS", () => {
    expect(directives(contentSecurityPolicy({ nonce: "n", dev: true })).get("script-src")).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy({ nonce: "n" })).not.toContain("unsafe-eval");
    expect(directives(contentSecurityPolicy({ nonce: "n", https: true })).has("upgrade-insecure-requests")).toBe(true);
  });

  it("lets the waitlist and analytics report to their hosts, and ignores an endpoint that isn't https://", () => {
    const connect = (options: { waitlistUrl?: string; analytics?: boolean }) => directives(contentSecurityPolicy({ nonce: "n", ...options })).get("connect-src");
    expect(connect({ waitlistUrl: "https://formspree.io/f/abc?x=1", analytics: true })).toBe("'self' blob: https://formspree.io https://cloudflareinsights.com");
    for (const waitlistUrl of ["http://forms.example", "javascript:alert(1)", "not a url; script-src *", ""]) {
      expect(connect({ waitlistUrl })).toBe("'self' blob:");
    }
  });
});
