# 14. Security

## Threat model

There is no server-side data, no accounts and no database, so the classic risks (data breaches, injection into a
backend, broken authentication) don't apply. What remains:

| Risk | Where | Mitigation |
| --- | --- | --- |
| A **malicious diagram file** (shared by someone else) | Opening files | Strict parsing; React escapes text; SVG export escapes text; sizes capped |
| **Spreadsheet formula injection** via exported CSV | CSV export | Cells starting with `= + - @ \t \r` are prefixed with `'` |
| **Script injection** (a bug that lets file content become HTML) | All pages | React escapes text; the Content-Security-Policy runs only scripts carrying the page's nonce, so injected `<script>` tags and `onerror=` handlers don't run |
| **Clickjacking** (the editor framed by another site) | All pages | `X-Frame-Options: DENY` and `frame-ancestors 'none'` |
| **MIME sniffing** | All pages | `X-Content-Type-Options: nosniff` |
| **Leaking URLs** to other sites | Links | `Referrer-Policy: strict-origin-when-cross-origin` |
| **Unneeded powerful APIs** | All pages | `Permissions-Policy` denies camera, microphone, geolocation |
| **Form spam** | Waitlist form | Required agreement box; the form provider's spam filtering (there's no contact form) |
| **Maintenance bypass** | Proxy | Secret token, HttpOnly + SameSite=Lax + Secure cookie, token removed from the URL |
| **Personal data** | Forms, analytics | Opt-in endpoints, explicit consent recorded; visit counts are cookieless, keep no IPs and skip GPC/Do Not Track |

## Opening files safely

See [validation](04-data-model-and-file-format.md#how-files-are-read--validatets). The essentials:

- **No raw spreading:** every field is read explicitly and type-checked; unknown keys are dropped, so nothing like
  `__proto__` or extra `data` fields reaches the store.
- **No HTML rendering of user text:** labels, notes and descriptions are rendered as React text (escaped). There is
  no `dangerouslySetInnerHTML` anywhere.
- **SVG export** builds markup by hand, so `escapeXml` escapes `& < > "` in the title and legend names; legend
  colours are validated hex; the embedded diagram is a URL-encoded data URI.
- **Absurd values** (sizes above 10,000 px, positions beyond ±100,000) are capped, so a file can't make rendering or
  export stall.
- **Size limits** (`src/lib/diagram/limits.ts`): files over 20 MB are refused before being read; a compressed
  draw.io page stops inflating at 50 MB (a small file can expand to gigabytes); a diagram with more than 100 tabs,
  5,000 components or 10,000 connections on one canvas, or a sequence with more than 200 participants or 5,000
  steps, is refused as too large.
- **Newer formats are refused** with a clear message instead of being half-read.

## HTTP headers

Set in `next.config.ts`:

```ts
poweredByHeader: false,            // no "X-Powered-By: Next.js"
headers: [{ source: "/:path*", headers: [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },   // no other window keeps a handle on this one
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" }, // other sites can't embed our files
]}]
```

`X-Frame-Options` and `frame-ancestors` say the same thing for old and new browsers. The `frame-ancestors`-only
policy here covers files (icons, the manifest); pages get the full policy below, which replaces it.

### Content-Security-Policy

Pages get a full policy from the proxy (`src/proxy.ts`), built by `contentSecurityPolicy()` in `src/lib/csp.ts`
with a fresh random nonce per request:

```
default-src 'self';
script-src 'self' 'nonce-<random>' 'strict-dynamic';   (+ 'unsafe-eval' in development only)
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' blob: <waitlist origin> https://cloudflareinsights.com;   (the last two only when configured)
worker-src 'self'; manifest-src 'self'; frame-src 'none'; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none';
upgrade-insecure-requests   (over HTTPS only)
```

**How the nonce gets to the scripts:** the proxy puts the policy and an `x-nonce` header on the *request*. Next.js
reads the nonce from the request's policy and adds it to every script it writes, inline and bundled; the root
layout reads `x-nonce` and passes it to `next-themes` for its theme script. `'strict-dynamic'` lets those scripts
load others (code-split chunks, the Cloudflare beacon) without listing hosts.

**Pages render per request.** A page built ahead of time would carry no nonce and its scripts would be blocked, so
the root layout reads the request headers, which makes every page dynamic (`ƒ` in the build output). The pages are
small and the diagram work is all in the browser, so the cost is a few milliseconds of server rendering per page
view. The service worker caches pages together with their headers, so offline copies keep a matching nonce.

Why each looser part is there:

- **`style-src 'unsafe-inline'`:** React renders `style="…"` attributes (component colours, sizes, positions) that a
  nonce can't cover. Injected CSS can't run code; it's the accepted trade-off.
- **`img-src data: blob:`:** exports draw the diagram through `data:` and `blob:` images (`html-to-image`).
- **`base-uri 'self'`, not `'none'`:** to embed fonts in an export, `html-to-image` sets a `<base>` to the
  stylesheet's address. With `'none'` the fonts 404 and exports fall back to system fonts.
- **`connect-src`:** the waitlist endpoint's origin (only an `https://` URL in `NEXT_PUBLIC_WAITLIST_URL`) and
  Cloudflare's beacon endpoint (only with `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`). The proxy reads them at runtime, so
  set them for the build and the runtime alike (the host does); a mismatch also makes the waitlist pages fail to
  hydrate (React error #418). `blob:` lets a page read back a file it made itself, which the TesterArmy tests do
  to check downloads; only script already running on the page can create one.

**Adding something external** (a script, font, image host, form endpoint): add its origin to the matching
directive in `src/lib/csp.ts` and check the browser console for `Refused to …` messages. A blocked resource fails
quietly otherwise.

### Deliberately not done (yet)

- **A nonce for styles.** It would need every `style={…}` moved to classes or CSS variables set from script.
- **Violation reports** (`report-to`). There's no endpoint to collect them.
- **HSTS** (`Strict-Transport-Security`). It depends on the host serving HTTPS only; set it at the host or add it
  here once that's confirmed. A wrong HSTS header is hard to undo, and `includeSubDomains` also affects every other
  subdomain of the site's domain. Start with a short `max-age` (for example 300), raise it over a few weeks, and
  only then think about `preload`.

## Files and exports are untrusted input, both ways

A diagram, legend or comment file can come from anyone, so what is read from it is checked (above), and what the app
**writes out** must keep it as text, because other tools open those files. Found and fixed in the last review:

| Output | Risk | What stops it |
| --- | --- | --- |
| Solution document (Markdown) | A name like `[x](javascript:…)`, an image, HTML, or a web address containing `)` could turn text into a live link in a Markdown viewer | `cell()` backslash-escapes Markdown syntax and `<`/`>`; link targets are percent-encoded (`target()`); only http(s) addresses (`safeWebAddress`) become links |
| PlantUML export | PlantUML runs `%function()` calls (such as `%getenv`) found in text when it renders | `%` is written as `<U+0025>`; newlines are flattened so a name can't start a `!include` line |
| Mermaid export | A name starting a new line (`click … call …`) | Names are flattened to one line and quoted |
| CSV | Spreadsheet formulas (`=HYPERLINK(…)`) | `csvCell` prefixes risky cells (see [export](10-export.md)) |
| Viewer (`.html`) | Diagram text running as script in the downloaded page | Everything is HTML-escaped; pictures are `<img>` data addresses (images never run script); the logo must be a PNG/JPEG/WebP data address |

`tests/lib/security.test.ts` holds hostile inputs for each. **Any new export or import must add one.**

## Maintenance bypass token

`MAINTENANCE_BYPASS_TOKEN` lets anyone who has it past maintenance mode, so it must be at least 16 random characters
(a shorter one is ignored), generated, not chosen (`openssl rand -hex 24`). It is compared in constant time. It sits in
the address once and then in an HttpOnly, Secure, 12-hour cookie. Rotate it after use.

## Dependencies

Run `pnpm audit --prod` before releases (CI fails on high-severity ones). Dependabot (`.github/dependabot.yml`) opens weekly
pull requests for packages and GitHub Actions; CI and the browser-test workflow run with read-only tokens (`permissions: contents: read`).

Run `pnpm audit --prod` before releases. At the time of writing it reports no known vulnerabilities. The
runtime dependency list is deliberately short (see [principles](01-product-and-principles.md#tech-stack-and-why-each-piece)).
