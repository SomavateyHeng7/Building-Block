/**
 * The site's public address, for links that must be absolute: the sitemap, robots.txt and link previews.
 * `SITE_URL` (e.g. https://buildingblock.app) wins; on Vercel its production domain is used when that's unset.
 * Read at build time for the cached robots.txt and sitemap, so changing it needs a rebuild.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  const configured = env.SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(/^https?:\/\//.test(configured) ? configured : `https://${configured}`);
      return new URL(url.origin);
    } catch {
      // Not an address: fall through.
    }
  }
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

/** Pages people (and search engines) can land on. The editor is left out: it's empty until a file is opened. */
export const PUBLIC_PAGES = ["/", "/diagrams", "/templates", "/pricing", "/changelog", "/contact", "/privacy"] as const;

/** Never worth indexing: an empty editor, and the page shown only while the site is being updated. */
export const UNLISTED_PAGES = ["/editor", "/maintenance"] as const;
