# 11. Privacy, consent and forms

## What data exists, and where

| Data | Where it lives | Leaves the device? |
| --- | --- | --- |
| Diagrams | Memory while open; the user's `.json` file | **Never** |
| Exports | Generated in the browser, downloaded | Never |
| Preferences (theme, panels, export choices) | `localStorage` | Never |
| Privacy-notice acceptance | `localStorage` (`bb:consent`) | Never |
| Waitlist email + consent record | Sent to the form provider | **Only if** `NEXT_PUBLIC_WAITLIST_URL` is set **and** the user ticks the box and submits |
| Maintenance bypass cookie | Cookie, HttpOnly | Sent to our server (team only) |
| Visit counts (page address, referrer, browser, device, country) | Cloudflare Web Analytics, no cookies | **Only if** `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` is set, and not when the browser sends GPC or Do Not Track |
| Standard hosting logs (IP, pages) | Hosting provider | Yes, as for any website |

The privacy notice (`src/app/privacy/page.tsx`) says the same thing in plain language. **If you change what is
stored or sent, update the notice and bump `PRIVACY_VERSION`** (below).

### Everything stored in the browser

| Key | Set by | Contents |
| --- | --- | --- |
| `theme` | `next-themes` | `"light"`, `"dark"` or `"system"` |
| `bb:panels` | `EditorApp` | `{ palette: boolean, properties: boolean }`: which side panels are collapsed |
| `bb:export` | `Toolbar` | `{ formats, bundle, theme }`: the last export choices |
| `bb:exportTheme` | *(earlier versions)* | Still read once as the default export style; never written |
| `bb:consent` | `src/lib/consent.ts` | `{ version, acceptedAt }` |
| `bb:diagram:*`, `bb:templates`, `bb:index`, `bb:backups` | *(earlier versions)* | Old diagrams; only read and, on request, removed (see [legacy](06-files-saving-and-unsaved-changes.md#leftovers-from-earlier-versions)) |

Every read and write is wrapped in `try/catch`: storage can be blocked (private browsing, policies), and the app
must still work. A blocked preference just isn't remembered.

## The consent gate

### Behaviour

On `/diagrams`, `/templates` and `/editor`, until the current privacy notice has been accepted, a dialog explains,
in three points:

1. Your diagrams stay on your device.
2. A few preferences are remembered here (theme, panels, export choices, and the acceptance itself), with no
   tracking or analytics.
3. Anything else (the waitlist) asks first.

…with a link to the full notice (opens in a new tab so the dialog stays), a checkbox **"I have read and accept
the privacy notice."**, and two buttons: **Not now** (goes to `/`) and **Accept and continue** (disabled until the
box is ticked).

The landing, privacy and contact pages are never gated: people must be able to read the notice, and contact us,
before agreeing to anything.

### Implementation — `src/components/ConsentGate.tsx` and `src/lib/consent.ts`

- **Mounted once** in the root layout; reads `usePathname()` to decide whether the current page is gated.
- **Versioned:** `acceptConsent()` stores `{ version: PRIVACY_VERSION, acceptedAt }`. `hasConsent()` is true only if
  the stored version equals the current `PRIVACY_VERSION`. Change that constant whenever the notice changes in a
  way people should agree to again, and everyone is asked again on their next visit.
- **Blocked storage:** acceptance is kept in memory for the tab (`acceptedThisSession`), so people can still use
  the app; they'll be asked again next time.
- **Server rendering:** the server snapshot of `hasConsent` is `true`, so pages pre-render without the dialog (and
  without a hydration mismatch); the browser's real answer replaces it immediately after hydration.
- **Nothing behind it can be used:** while open, every other child of `<body>` gets the `inert` attribute (no
  clicks, no keyboard focus, hidden from screen readers), and the dialog is portalled to `<body>` with
  `role="dialog"`, `aria-modal`, a label and a description. The checkbox has initial focus.
- **Subscriptions:** `subscribeConsent` notifies the gate and the privacy page when consent is accepted or
  withdrawn, so both update instantly.

### Withdrawing — `src/app/privacy/WithdrawConsent.tsx`

On `/privacy`, a box shows "You accepted this notice on 20 October 2026." and **Withdraw my acceptance**
(`withdrawConsent()` removes the record). The next visit to an app page asks again. The notice's version is shown
under it.

## The waitlist form — `src/components/landing/WaitlistForm.tsx`

- Only rendered when `NEXT_PUBLIC_WAITLIST_URL` is set (in development, a hint explains how to turn it on), so
  visitors never submit into nothing.
- An email field and a **required agreement checkbox** ("I agree that Building Block may store my email…"). The
  button is disabled until it's ticked.
- POSTs JSON: `{ email, source: "landing", consent: { agreed: true, privacyVersion, at } }`. **Why record the
  consent with the email:** it shows what the person agreed to and when, if anyone asks.

## The contact page — `src/app/contact/`

`page.tsx` (server) shows the heading, two self-help cards (lost work, data questions), and an **Email us** section
with the address from `NEXT_PUBLIC_CONTACT_EMAIL`, what helps us reply (for a problem: what happened and which
browser, without confidential diagram content; for a privacy request: that we hold no diagrams), and a **Write an
email** button (`mailto:`, subject "Building Block"). The address is shown as text too, for people without an email
app set up. Without the variable the section is hidden (in development, a hint says how to show it).

**Why no form:** the product has no server by design, and a form provider would be one more place people's details
go. Email keeps it simple: people write from their own email, and the app sends nothing. (There was a form, posting
to a provider; it was removed in October 2026.)

## The privacy notice — `src/app/privacy/page.tsx`

A static page built from a `SECTIONS` array: your diagrams, what is stored in your browser, waitlist, writing to us,
cookies/analytics/fonts, hosting logs, plus the acceptance box. Keep it in step with the tables above.
