import { describe, expect, it } from "vitest";
import { PUBLIC_PAGES, UNLISTED_PAGES, siteUrl } from "@/lib/site/site";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("site address", () => {
  it("uses SITE_URL, keeping only its origin and adding https when it's missing", () => {
    expect(siteUrl({ SITE_URL: "https://example.com/some/path" }).href).toBe("https://example.com/");
    expect(siteUrl({ SITE_URL: "example.com" }).href).toBe("https://example.com/");
  });

  it("falls back to Vercel's production domain, then to localhost", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "bb.vercel.app" }).href).toBe("https://bb.vercel.app/");
    expect(siteUrl({ SITE_URL: "  ", VERCEL_PROJECT_PRODUCTION_URL: "bb.vercel.app" }).href).toBe("https://bb.vercel.app/");
    expect(siteUrl({}).href).toBe("http://localhost:3000/");
  });
});

describe("robots and sitemap", () => {
  it("list every public page and keep the editor and maintenance page out", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(urls).toEqual([...PUBLIC_PAGES]);
    for (const page of UNLISTED_PAGES) expect(urls).not.toContain(page);
    const rules = robots().rules;
    expect(Array.isArray(rules) ? rules[0].disallow : rules.disallow).toEqual([...UNLISTED_PAGES]);
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
