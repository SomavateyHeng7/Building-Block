# 16. Operations

## Environment variables

| Variable | Read | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_WAITLIST_URL` | **Build time** | Shows the landing-page waitlist form, which POSTs JSON to this URL (e.g. a Formspree form) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Build time | The address shown on `/contact` for people to write to; unset hides the email section |
| `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` | Build time | Turns on visit counting with Cloudflare Web Analytics ([monitoring visits](#monitoring-visits)) |
| `MAINTENANCE_MODE` | **Per request** | `on` / `true` / `1` / `yes` turns maintenance mode on |
| `MAINTENANCE_UNTIL` | Per request | Optional ISO time, e.g. `2026-10-08T18:00Z`. Shown in the visitor's time zone; sets `Retry-After` |
| `MAINTENANCE_MESSAGE` | Per request | Optional text replacing the default explanation |
| `MAINTENANCE_BYPASS_TOKEN` | Per request | Optional secret; `?preview=<token>` lets that browser use the real site for 12 hours |

`NEXT_PUBLIC_*` values are compiled into the JavaScript, so **changing them needs a rebuild and redeploy**. The
maintenance variables are read by the proxy on each request, so they can be changed at the host and take effect
without a rebuild (on hosts that apply environment changes without redeploying; otherwise redeploy without
rebuilding).

Leave every variable unset to run fully offline: no data can leave the browser.

`.env*` files are git-ignored (except `.env.example`, which lists every variable); set variables in the hosting
dashboard. A production build prints a warning naming any of the three `NEXT_PUBLIC_*` variables that are unset, so a
release can't quietly ship without them. **Set `NEXT_PUBLIC_CONTACT_EMAIL` for launch:** the privacy notice sends
people to the contact page for data requests. Without it the page points to the website and social pages instead.

## Building and deploying

```bash
pnpm install
pnpm build      # all pages static except /maintenance and the proxy
pnpm start      # serves the build (default port 3000)
```

Any Node host that supports Next.js 16 (e.g. Vercel) works. The proxy needs server (edge or Node) support;
without it maintenance mode won't work but the app still will.

Before releasing: run the checks in [Testing and QA](15-testing-and-qa.md) and the manual checklist for anything you
changed. CI already runs lint, types, tests, `pnpm build` and `pnpm audit --prod --audit-level high`.

## Monitoring visits

Visit counts come from **Cloudflare Web Analytics** (free; cookieless; works on any host). The admin view is the
Cloudflare dashboard: visitors and page views over time, top pages, where people came from, countries, browsers and
devices, and page speed. There's no admin page in the app: the app has no server-side storage to keep counts in.

**Setting it up** (once the site has its public address):

1. In the Cloudflare dashboard, open **Analytics & Logs → Web Analytics → Add a site**, enter the site's hostname
   and choose the JavaScript snippet (the site doesn't need to use Cloudflare DNS).
2. Copy the token from the snippet (`data-cf-beacon='{"token": "…"}'`).
3. Set `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` to it at the host and **rebuild** (it's compiled in).

`src/components/Analytics.tsx` then adds the beacon in production on every page, counting moves between pages inside
the app too. It isn't loaded in development, without the token, or for browsers that send Global Privacy Control or
Do Not Track. Only page addresses are sent, never diagram content. To add other teammates as viewers, invite them to
the Cloudflare account.

## Maintenance mode runbook

1. *(Optional)* Set `MAINTENANCE_BYPASS_TOKEN` to a long random value, `MAINTENANCE_UNTIL` to when you expect to be
   back, and `MAINTENANCE_MESSAGE` if the default text doesn't fit.
2. Set `MAINTENANCE_MODE=on`. Every page now answers **503** with the maintenance page. The address bar keeps the
   requested URL, and the page re-checks every 30 seconds.
3. Deploy the release. To check it before reopening, visit any page with `?preview=<token>`: the token is moved
   into a cookie and removed from the URL, and that browser sees the real site for 12 hours.
4. Set `MAINTENANCE_MODE` back to off. Visitors' maintenance pages notice within 30 seconds and reload, back to the
   page they asked for; anyone on `/maintenance` itself is redirected home.

**Users' work is safe throughout:** diagrams are files on their devices, and an open editor tab keeps working
(only navigation and reloads hit the maintenance page). The maintenance page tells people to keep working and save
as usual.

## Changing the privacy notice

1. Edit `src/app/privacy/page.tsx` (and the consent dialog's summary in `src/components/ConsentGate.tsx` if the
   short version changes).
2. Set `PRIVACY_VERSION` in `src/lib/consent.ts` to today's date. Everyone is asked to accept again.
3. Update [Privacy, consent and forms](11-privacy-consent-and-forms.md).

## Browser storage keys

Listed in [Privacy, consent and forms](11-privacy-consent-and-forms.md#everything-stored-in-the-browser). If you add
one, add it there and to the privacy notice.
