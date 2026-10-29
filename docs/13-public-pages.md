# 13. Public pages

## Landing page — `src/app/page.tsx`

A server component, pre-rendered. Sections: sticky header (logo, in-page links, Templates, Pricing, Contact us, Start, theme toggle),
hero with **Start drawing** and **Browse templates**, the `HeroDiagram`, three problem statements, six feature
cards, three "how it works" steps, the **roadmap**, the team waitlist, a final call to action, and the footer.

- **Roadmap:** `getLevels()` and `roadmapHeading()` from `src/lib/levels.ts` (computed from the store's actions;
  see [levels](09-connections-and-internal-designs.md)). It is computed at build time, which is fine because it only
  changes when the code changes.
- **`HeroDiagram.tsx`:** a static, non-interactive picture of an editor, drawn with HTML and the default legend
  colours (so it is sharp, themed, and needs no image). `role="img"` with a description for screen readers.
- **Anchors** (`#features`, `#how-it-works`, `#roadmap`) use `scroll-mt-20` so the sticky header doesn't cover the
  heading. The footer links use `/#…` so they work from other pages.

## Footer — `src/components/landing/Footer.tsx`

Product links (including **Pricing**), Get started links, © year, **Privacy**, **Contact**, and "Your diagrams are your files".
`CurrentYear.tsx` renders the year in the browser: the page is pre-rendered at build time, so a server-rendered
year would be stale until the next deploy.

## Pricing — `src/app/pricing/page.tsx` and `src/lib/plans.ts`

A server component, pre-rendered, not behind the consent gate. One card per plan in `PLANS`: today **Free** (the whole
app) and **Pro** and **Team**, marked *Coming soon* with "Price to be announced". The intro says what's free stays
free and that plans and prices may change.

- **Buttons:** Free → *Start drawing* (`/diagrams`). A plan that isn't out yet → *Notify me*, which jumps to a
  waitlist form at the bottom (`WaitlistForm` with `source: "pricing"`, so those signups can be told apart); without
  a waitlist URL, *Ask about …* emails the contact address; with neither, no button.
- **Going live with a plan:** in `plans.ts`, give it a `price`, `status: "available"` and a `checkoutUrl` (e.g. a
  Stripe Payment Link). The card then shows the price and **Subscribe** (`canSubscribe` checks all three, and that the
  link is https). Before taking money: terms of sale, the privacy notice (the payment provider becomes a processor;
  bump `PRIVACY_VERSION`), and tax and invoicing for where you sell.
- **Limits (built, not enforced):** a plan's `limits` say what it allows; Free has `sequenceCodeLines:
  FREE_SEQUENCE_CODE_LINES` (100 non-blank lines of Mermaid code per sequence tab). `checkSequenceCodeLines` works
  out `used`, `limit`, `over` and `blocked`; the code panel's Apply refuses only when `blocked`, which needs
  `LIMITS_ENFORCED = true`. Everyone is on `currentPlan()` (Free) until there are accounts. Turning limits on also
  means saying so on the Free card, which still says "Unlimited".
- **Why no payments yet:** nothing is for sale. A config of plans keeps the page honest now and makes launch a
  small change, without a server or webhooks to maintain in the meantime.

## What's new — `src/app/changelog/page.tsx` and `src/lib/changelog.ts`

A public page (no consent needed) listing `CHANGELOG`, newest first, linked from the footer. Entries are written for
the people who use the app: what they can now do, one sentence each. **Add an entry with any release people will
notice.** `tests/lib/changelog.test.ts` checks the order and that each entry says something.

**Plan limits:** while `LIMITS_ENFORCED` is off, the sequence code panel still shows how many lines are used once it
passes 80 % of the Free limit (`limitNotice` in `plans.ts`), and says plainly that nothing is blocked yet. Turning
enforcement on changes that wording to "allows", and `/pricing` must say so too.

## Start page — `src/app/diagrams/page.tsx`

- **New blank diagram** (default legend), **Open a diagram file** (the picker), or **drop a `.json` anywhere** on
  the page (a full-page overlay appears while a file is dragged over; leaving it means the drag left the window).
- **Start from a template:** cards with a `TemplatePreview`; a lone last card spans the row.
- **"Your diagrams are your files"** box, explaining whether this browser can save in place (only shown after
  mounting, because which browser it is is only known in the browser).
- **Leftovers from earlier versions:** see [files](06-files-saving-and-unsaved-changes.md#leftovers-from-earlier-versions).
  Read once per page load with `useSyncExternalStore` and a cached snapshot (a new array each call would loop).
- **Every way of starting** goes through `useUnsavedGuard`, because after the browser's Back button the previous
  diagram may still be open with unsaved changes.

## Templates — `src/app/templates/page.tsx` and `src/templates/`

`allTemplates` in `src/templates/index.ts` lists every `TemplateDefinition` (`id`, `name`, `description`, `build()`,
`hidden?`); `templates` is the ones offered on the start page and here, without the `hidden` ones. A hidden template
still builds, is tested, and is found by `getTemplate`; removing `hidden` brings it back.

| Template | `build()` |
| --- | --- |
| `blank` | `createBlankDiagram("Untitled Diagram")` |
| `l0-architecture` | Four containers (channels, core systems, integration, infrastructure) of components laid out in columns with the default legend, plus three example connections (one dashed "Order events · Kafka"). The column gap leaves room for connection labels. |
| `three-tier` | Presentation, application and data tiers plus an external identity provider, with technologies and six connections. |
| `event-driven` | Clients → API gateway → order services → event broker → downstream services, a payment provider, and an **internal design (L2)** for the Order Service. |
| `serverless` | Clients → CDN and API gateway → functions → a table, a queue that triggers a worker, and a bucket. |
| `data-platform` | Sources → ingestion (CDC, batch connectors, an event stream) → a lake and a warehouse → ML, dashboards and reverse ETL. |
| `current-vs-target` | **Hidden for now.** Two tabs, **Current** and **Target**, that differ in added, removed and recategorised components, made to show **Compare tabs**. Browser tests that open it are held back from the TesterArmy sync until it's shown again. |
| `sequence` | A checkout flow as a sequence tab: calls, a self-call, replies, async events and a note. |

Sequence templates are written as data too (participants and steps by name) and built by `buildSequenceDiagram` in
`src/templates/sequence-build.ts`. Every architecture template is written as data (columns of containers holding components, and connections by
component name) and laid out by `buildDiagram` / `buildCanvas` in `src/templates/build.ts`: fixed column widths and
gaps, containers stacked within a column, and connection sides facing each other (right → left across columns,
bottom → top within one). `tests/templates/templates.test.ts` checks every template opens without repairs, mints
fresh ids, connects only components that exist, and fits every component inside its container.

`build()` creates fresh ids every time, so two diagrams from the same template never share ids.

`src/components/TemplatePreview.tsx` draws a scaled-down SVG of a template's first tab from the same data the
editor loads (containers, components with their colours, and connections as curves), so previews can't drift from
what opens. It calls `build()` once per card (`useState(build)`), because each call mints new ids.

## Maintenance page — `src/app/maintenance/`

Shown by the proxy during maintenance (see [routing](03-routing.md#4-the-proxy-maintenance-mode--srcproxyts)).

- `page.tsx` (dynamic): the logo with an amber pulse, the message (`MAINTENANCE_MESSAGE` or a default), "Your
  diagrams are safe" (they're files, so an update can't touch them), and `noindex`.
- `MaintenanceStatus.tsx` (client): "Expected back by …" in the visitor's time zone (only if
  `MAINTENANCE_UNTIL` is in the future: a passed time would only worry people), **Try again**, and an automatic
  check every 30 seconds. The check is a `HEAD` request to the page's own URL with `no-store`; anything other than
  503 means the site is back, and the page reloads.

## Error pages

See [routing](03-routing.md#error-boundaries).

## Theme

`ThemeToggle` (`src/components/theme-toggle.tsx`) offers Light and Dark (a System option is written but commented
out). `useMounted()` in the same file is the shared "are we in the browser yet?" hook: `false` during server
rendering and hydration, `true` after. **Why it matters:** the active theme is only known in the browser, so the
toggle doesn't show a pressed button until then.
