# 16. Operations

## Environment variables

| Variable | Read | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_WAITLIST_URL` | **Build time** | Shows the landing-page waitlist form, which POSTs JSON to this URL (e.g. a Formspree form) |
| `NEXT_PUBLIC_CONTACT_URL` | Build time | The `/contact` form POSTs JSON here |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Build time | Shown on `/contact`; with no contact URL, the form opens the visitor's email app addressed to it |
| `MAINTENANCE_MODE` | **Per request** | `on` / `true` / `1` / `yes` turns maintenance mode on |
| `MAINTENANCE_UNTIL` | Per request | Optional ISO time, e.g. `2026-10-08T18:00Z`. Shown in the visitor's time zone; sets `Retry-After` |
| `MAINTENANCE_MESSAGE` | Per request | Optional text replacing the default explanation |
| `MAINTENANCE_BYPASS_TOKEN` | Per request | Optional secret; `?preview=<token>` lets that browser use the real site for 12 hours |

`NEXT_PUBLIC_*` values are compiled into the JavaScript, so **changing them needs a rebuild and redeploy**. The
maintenance variables are read by the proxy on each request, so they can be changed at the host and take effect
without a rebuild (on hosts that apply environment changes without redeploying; otherwise redeploy without
rebuilding).

Leave every variable unset to run fully offline: no data can leave the browser.

`.env*` files are git-ignored; set variables in the hosting dashboard.

## Building and deploying

```bash
pnpm install
pnpm build      # all pages static except /maintenance and the proxy
pnpm start      # serves the build (default port 3000)
```

Any Node host that supports Next.js 16 (e.g. Vercel) works. The proxy needs server (edge or Node) support;
without it maintenance mode won't work but the app still will.

Before releasing: run the checks in [Testing and QA](15-testing-and-qa.md), `pnpm audit --prod`, and the manual
checklist for anything you changed.

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
