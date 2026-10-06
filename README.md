# Building Block

Browser-based L0 architecture diagrams for solution architects. Build a landscape from containers and
components, colour them with a legend you define, and export for review decks and solution documents.

**No account, no server, no database, and no copy in the browser.** A diagram is a `.json` file on your
device, like draw.io's device storage. The app holds the diagram in memory only while it is open.

## Features

- Containers and components with drag-in nesting, resize, snap-to-grid and a minimap
- A user-defined legend; exports include only the categories used
- Details per component: technology, owner, description, notes
- Align, distribute, match size, fit container, tidy layout
- Several tabs per diagram (e.g. current vs target) with copy/paste between them
- Built-in templates; to reuse your own layout, save it as a file and open that
- Export: PNG, PDF, SVG, component list (CSV), JSON; PNG/PDF can cover all tabs
- Works on desktop, tablet and phone (see [Devices](#devices))
- Keyboard shortcuts (press `?` in the editor)

L1 (interactions) and L2 (component detail) are planned, not built.

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

Only your theme and export-style preferences use `localStorage`, never diagram data.

### Diagrams from an earlier version

Earlier versions kept diagrams and templates in `localStorage`. They can no longer be opened in the app. If
any are found, the start page lists them with **Download** (each or all) and a confirmed **Remove from this
browser**. Nothing is deleted unless you choose it.

## Devices

- Layout adapts to the viewport; below 1024px the palette and details panels become drawers over the canvas.
- Touch: tap a palette item to add it (drag-and-drop is also supported where the browser allows it). Touch
  targets are at least 40px and inputs are 16px so iOS does not zoom.
- Safe-area insets are respected on notched phones, and the minimap is hidden on small screens.

Browser behaviour for saving is in the table above; everything else is the same everywhere.

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # unit tests: validation, layout, and file save / dirty tracking
pnpm lint
pnpm build
```

Optional: set `NEXT_PUBLIC_WAITLIST_URL` to a form endpoint that accepts a JSON `{ email }` POST to show
the landing-page waitlist form. Leave it unset to keep the app fully offline. This is the only place data
can leave the browser.

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

### Stack

Next.js 16 / React 19 / Tailwind 4 / React Flow / Zustand. See `AGENTS.md` before changing Next.js code.

### Not covered by automated tests

Saving through a real browser's file picker, the tab-close warning, and touch behaviour on physical devices
are checked by hand. Test Chrome or Edge, and one of Safari or Firefox, when changing `file.ts`.
