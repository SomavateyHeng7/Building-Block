/**
 * The Content-Security-Policy for pages, set per request by the proxy (src/proxy.ts) with a fresh nonce.
 *
 * Scripts: only those carrying the nonce run (Next.js adds it to its own scripts, inline and bundled; next-themes
 * gets it from the root layout), plus what they load (`'strict-dynamic'`, which covers the analytics beacon).
 * An injected `<script>` or `onerror=` handler doesn't run. Styles allow inline: React renders `style="…"`
 * attributes (component colours, positions) that a nonce can't cover, and injected CSS can't run code.
 */

/** Request header the proxy passes the nonce to the page in; the root layout reads it. */
export const NONCE_HEADER = "x-nonce";

interface CspOptions {
  nonce: string;
  /** Development: React needs eval for its error overlay and stacks. */
  dev?: boolean;
  /** Served over HTTPS: any stray http:// request is upgraded instead of failing as mixed content. */
  https?: boolean;
  /** The waitlist form's endpoint (NEXT_PUBLIC_WAITLIST_URL); its origin may be posted to. */
  waitlistUrl?: string;
  /** Visits are counted (NEXT_PUBLIC_CF_ANALYTICS_TOKEN set): the beacon reports to Cloudflare. */
  analytics?: boolean;
}

/** The origin of an https:// URL, or null for anything else (an unset or mistyped variable adds nothing). */
function httpsOrigin(url: string | undefined): string | null {
  try {
    const parsed = new URL(url ?? "");
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({ nonce, dev = false, https = false, waitlistUrl, analytics = false }: CspOptions): string {
  // blob: lets a page read back a file it made itself (the browser tests check downloads that way); only script
  // already running here can create one, so it opens no way out.
  const connect = ["'self'", "blob:", httpsOrigin(waitlistUrl), analytics ? "https://cloudflareinsights.com" : null].filter(Boolean);
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Exports draw the diagram through data: and blob: images.
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    // Not 'none': export (html-to-image) points <base> at the stylesheet to find the fonts it embeds.
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}
