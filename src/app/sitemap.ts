import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PAGES.map((path) => ({
    url: new URL(path, base).href,
    changeFrequency: path === "/changelog" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
