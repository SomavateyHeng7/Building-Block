# Building Block

Browser-based L0 architecture diagrams for solution architects. Build a landscape from containers and
components, colour them with a legend you define, and export for review decks and solution documents.

**No account, no server, no database, and no copy in the browser.** A diagram is a `.json` file on your
device, like draw.io's device storage. The app holds the diagram in memory only while it is open.

## Features

- Containers and components with drag-in nesting, resize, snap-to-grid and a minimap
- A user-defined legend with a named colour palette (it marks colours another category already uses) and
  custom colours; exports include only the categories used
- Connections between components (L1): drag from the dot on a component's edge to another, or pick one in
  the details panel. Each has a label (what flows), a protocol, a description, arrows (one way, both ways,
  none) and a solid or dashed line. Lines run in right angles, curved or straight; drag the dot on a selected line to
  move it clear of other boxes (double-click the dot to put it back), or **Attach to nearest sides** to re-route it
- Internal design per component (L2): open a component to draw what it's made of on its own canvas, with
  its own containers, components and connections. The details panel shows the component's L1 connections
  alongside, a bar above the canvas leads back, and an **L2** badge marks components that have one. It is
  saved inside the same `.json` file, one level deep
- Details per component: technology, owner, description, notes
- **Find (Ctrl/⌘+F):** search names, technology, owner, category, notes and connections across every tab and
  internal design; picking a result opens its tab, selects it and zooms to it
- A built-in icon per component (service, API, web, mobile, database, cache, storage, queue, event stream,
  function, scheduler, analytics, identity, notification, user, external system, cloud). The icons ship with the
  app, so they work offline and appear in every export
- Align, distribute, match size, fit container, tidy layout
- Several tabs per diagram (e.g. current vs target) with copy/paste between them
- **Compare tabs:** pick two tabs to list the components, containers and connections added, removed and changed
  between them (matched by name), jump to any of them, or download the change list as a CSV. **Show on canvas** outlines and tags what was added and
  changed (on the newer tab) and removed (on the older one); exports taken while it's shown include the marks and
  a legend for them
- Built-in templates (L0 architecture, three-tier web application, event-driven microservices with an internal
  design, current vs target state); to reuse your own layout, save it as a file and open that
- Export dialog: pick any mix of PNG, SVG, PDF, component list (CSV), connection list (CSV) and the diagram
  file (JSON), and which tabs and internal designs to picture. Download it all as **one file** (a `.zip`,
  or a single PDF with a page per view) or as **separate files**. The dialog shows exactly what you'll get;
  the CSVs say which component each internal item is part of
- Works on desktop, tablet and phone (see [Devices](#devices))
- Keyboard shortcuts (press `?` in the editor)

The landing page's roadmap works out which levels exist from the editor's code (`src/lib/levels.ts`), so it stays current: L0 (landscape), L1 (connections) and L2 (a component's internal design) are all built.

## Where your diagrams live

| Action | How |
| --- | --- |
| Start | `/diagrams`: **New diagram**, **Open file**, or **Browse templates** |
| Open | *File → Open…* reads a `.json` file from your device |
| Save | *File → Save* or Ctrl/⌘+S |
| Save as | *File → Save as…* or Ctrl/⌘+Shift+S |
| Export a copy | *Export → JSON* (a copy you can re-open with Open) |

How saving behaves depends on the browser:

| Browser | Save behaviour |
| --- | --- |
| Chrome, Edge, Opera (desktop and Android) | Saves in place to the file you opened or chose (File System Access API). After the first save, edits autosave about a second later. |
| Safari, Firefox, iPad browsers | These cannot write back to a file. **Save** downloads a new `.json` each time and **Open** uses a file picker. |

The toolbar shows **Not saved to a file**, **Unsaved changes**, or **Saved · name.json**. If a save
fails, autosave pauses and the toolbar shows **Not saved** until you save manually.

Unsaved work exists only in memory:

- Closing or reloading the tab warns first while there are unsaved changes.
- **New**, **Open** and **Start** ask Save / Don't save / Cancel.
- A reload with nothing saved returns you to the start page.

Only your theme, collapsed panels, last export choices and privacy-notice acceptance use `localStorage`,
never diagram data.

### Privacy notice

The app pages (`/diagrams`, `/templates`, `/editor`) ask people to accept the privacy notice once before use;
the landing, privacy and contact pages stay open. The acceptance records the notice's version
(`PRIVACY_VERSION` in `src/lib/consent.ts`): **change it whenever the notice changes**, and everyone is asked
again. People can withdraw it on `/privacy`. The waitlist and contact forms ask for their own agreement.

### Diagrams from an earlier version

Earlier versions kept diagrams and templates in `localStorage`. They can no longer be opened in the app. If
any are found, the start page lists them with **Download** (each or all) and a confirmed **Remove from this
browser**. Nothing is deleted unless you choose it.

## Devices

- Layout adapts to the viewport; below 1024px the palette and details panels become drawers over the canvas.
  On wider screens either panel can be collapsed with the button at its top; a slim strip stays at the edge to open it again.
- Touch: tap a palette item to add it (drag-and-drop is also supported where the browser allows it). Touch
  targets are at least 40px and inputs are 16px so iOS does not zoom.
- Safe-area insets are respected on notched phones, and the minimap is hidden on small screens.

Browser behaviour for saving is in the table above; everything else is the same everywhere.

## Development

Developer documentation (architecture, routing, data model, every module and the reasons behind it) is in
[`docs/`](docs/README.md).

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # unit tests in tests/ (mirrors src/): diagrams, files, exports, zip, consent, toasts
pnpm lint
pnpm build
```

Optional form endpoints (each accepts a JSON POST, e.g. a Formspree form). Leave them unset to keep the app
fully offline; these forms are the only places data can leave the browser:

| Variable | What it turns on |
| --- | --- |
| `NEXT_PUBLIC_WAITLIST_URL` | The landing-page waitlist form (`{ email, consent }`) |
| `NEXT_PUBLIC_CONTACT_URL` | The `/contact` form (`{ name, email, topic, message, consent }`) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | An address shown on `/contact`; without a form URL, the form opens the visitor's email app instead |

### Project layout

| Path | What is there |
| --- | --- |
| `src/app/` | Routes: `/` landing, `/diagrams` start page, `/templates`, `/editor` |
| `src/components/editor/` | Editor UI: canvas, toolbar, palette, details panel, dialogs |
| `src/lib/diagram/store.ts` | Diagram state and undo history (Zustand) |
| `src/lib/diagram/file.ts` | Open, Save, Save as, autosave and unsaved-change tracking |
| `src/lib/diagram/legacy.ts` | Reads and clears diagrams left in `localStorage` by earlier versions |
| `src/lib/diagram/export.ts` | PNG, PDF, SVG, CSV and JSON export |
| `src/templates/` | Built-in templates |
| `tests/` | Unit tests, in folders mirroring `src/` |

### Stack

Next.js 16 / React 19 / Tailwind 4 / React Flow / Zustand. See `AGENTS.md` before changing Next.js code.

### Not covered by automated tests

Saving through a real browser's file picker, the tab-close warning, and touch behaviour on physical devices
are checked by hand. Test Chrome or Edge, and one of Safari or Firefox, when changing `file.ts`.
