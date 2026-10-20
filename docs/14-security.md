# 14. Security

## Threat model

There is no server-side data, no accounts and no database, so the classic risks (data breaches, injection into a
backend, broken authentication) don't apply. What remains:

| Risk | Where | Mitigation |
| --- | --- | --- |
| A **malicious diagram file** (shared by someone else) | Opening files | Strict parsing; React escapes text; SVG export escapes text; sizes capped |
| **Spreadsheet formula injection** via exported CSV | CSV export | Cells starting with `= + - @ \t \r` are prefixed with `'` |
| **Clickjacking** (the editor framed by another site) | All pages | `X-Frame-Options: DENY` and `frame-ancestors 'none'` |
| **MIME sniffing** | All pages | `X-Content-Type-Options: nosniff` |
| **Leaking URLs** to other sites | Links | `Referrer-Policy: strict-origin-when-cross-origin` |
| **Unneeded powerful APIs** | All pages | `Permissions-Policy` denies camera, microphone, geolocation |
| **Form spam** | Contact form | Honeypot field |
| **Maintenance bypass** | Proxy | Secret token, HttpOnly + SameSite=Lax + Secure cookie, token removed from the URL |
| **Personal data** | Forms | Opt-in endpoints, explicit consent recorded, no analytics |

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
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
]}]
```

`X-Frame-Options` and `frame-ancestors` say the same thing for old and new browsers.

### Deliberately not done (yet)

- **A full Content-Security-Policy** (`script-src` etc.). Next.js and `next-themes` use inline scripts, so a strict
  policy needs per-request nonces (making every page dynamic) and its own testing. Only `frame-ancestors` is set.
- **HSTS** (`Strict-Transport-Security`). It depends on the host serving HTTPS only; set it at the host or add it
  here once that's confirmed. A wrong HSTS header is hard to undo.

## Dependencies

Run `pnpm audit --prod` before releases. At the time of writing it reports no known vulnerabilities. The
runtime dependency list is deliberately short (see [principles](01-product-and-principles.md#tech-stack-and-why-each-piece)).
