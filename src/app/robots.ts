import type { MetadataRoute } from "next";
import { siteUrl, UNLISTED_PAGES } from "@/lib/site/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...UNLISTED_PAGES] },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
