# 13. Public pages

## Landing page — `src/app/page.tsx`

A server component, pre-rendered. Sections: sticky header (logo, in-page links, Templates, Start, theme toggle),
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

Product links, Get started links, © year, **Privacy**, **Contact**, and "Your diagrams are your files".
`CurrentYear.tsx` renders the year in the browser: the page is pre-rendered at build time, so a server-rendered
year would be stale until the next deploy.

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

`templates` in `src/templates/index.ts` lists `TemplateDefinition`s (`id`, `name`, `description`, `build()`):

| Template | `build()` |
| --- | --- |
| `blank` | `createBlankDiagram("Untitled Diagram")` |
| `l0-architecture` | Four containers (channels, core systems, integration, infrastructure) of components laid out in columns with the default legend, plus three example connections (one dashed "Order events · Kafka"). The column gap leaves room for connection labels. |

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
