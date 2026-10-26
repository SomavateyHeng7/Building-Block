# 1. Product and principles

## What Building Block is

A browser-based editor for **architecture diagrams for solution architects**. An architect builds:

- **L0 — landscape:** containers (domains, layers) holding components (systems, services), each coloured by a
  legend category the architect defines (e.g. "New", "Replacement", "3rd party").
- **L1 — interactions:** connections between components, each with *what flows* ("Orders"), *how*
  ("REST", "Kafka"), a description, arrows and a solid or dashed line.
- **L2 — internal design:** for any component, its own canvas showing what it is made of.

A diagram can have several **tabs** (e.g. current state vs target state). Diagrams are exported as PNG, SVG, PDF,
a component list (CSV), a connection list (CSV) and the diagram file itself (JSON), for review decks and
solution documents.

## The principles every change must keep

These are product promises, written into the README, the privacy notice and the UI. Code reviews should reject
changes that break them.

### 1. No server, no account, no copy in the browser

Diagrams never leave the user's device. There is no backend, no database, and the app does **not** keep
diagrams in `localStorage` or IndexedDB.

**Why:** architects draw internal systems. A tool that uploads diagrams needs a security review before anyone may
use it at work; a tool that only touches local files doesn't. "Your diagrams are your files" is the main reason
to choose this product over a SaaS whiteboard.

**Consequences in the code:**

- The diagram lives only in memory (the Zustand store) while it is open ([store](05-diagram-store-and-undo.md)).
- The user's `.json` file is the only copy. Open reads it, Save writes it ([files](06-files-saving-and-unsaved-changes.md)).
- A reload loses unsaved work, so the app warns before every way of losing it.
- Exports are rendered in the browser ([export](10-export.md)).
- Earlier versions *did* store diagrams in `localStorage`. The start page now only offers to download and
  remove them ([files](06-files-saving-and-unsaved-changes.md#leftovers-from-earlier-versions)).

### 2. Diagrams never leave the browser; little else does

One optional form sends data to a form provider: the **waitlist** (an email address). It's switched off unless its
environment variable is set, and it requires an explicit agreement checkbox. To contact us, people email the address
on the contact page from their own email; the app sends nothing ([forms](11-privacy-consent-and-forms.md)).

Visits are counted, if turned on, with Cloudflare Web Analytics: cookieless, no profile, page addresses only, never
diagram content, and not at all for browsers that send Global Privacy Control or Do Not Track
([operations](16-operations.md#monitoring-visits)).

### 3. Never lose work silently

Every action that replaces the open diagram (New, Open, a template, the start page after the Back button,
closing the tab) either has nothing to lose or asks **Save / Don't save / Cancel** first. A save that fails says
so and stops autosave until the user saves successfully.

### 4. People accept the privacy notice before using the app

The app pages ask once for acceptance of the privacy notice, recorded with its version so a changed notice is
asked again ([consent](11-privacy-consent-and-forms.md#the-consent-gate)).

### 5. Works on desktop, tablet and phone

Below 1024px the side panels become drawers; touch targets are at least 40px; inputs are 16px so iOS doesn't zoom;
safe-area insets are respected ([editor UI](07-editor-ui.md#responsive-layout)).

### 6. Files from anyone must open safely

A diagram file may come from a colleague, an old version, or be hand-edited. Opening it must never crash the
editor or run anything. Files are validated and repaired, and the user is told what was fixed
([validation](04-data-model-and-file-format.md#how-files-are-read--validatets)).

## Tech stack, and why each piece

| Piece | Version | Why we use it |
| --- | --- | --- |
| [Next.js](https://nextjs.org) (App Router, Turbopack) | 16.3 | Static pre-rendering of the marketing and app pages, file-based routing, the `proxy` for maintenance mode. **Note:** Next 16 differs from older docs: read `node_modules/next/dist/docs/` before changing Next code (see `AGENTS.md`). |
| React | 19.3 | UI. `useSyncExternalStore` is used throughout to read browser-only state safely during hydration. |
| [React Flow](https://reactflow.dev) (`@xyflow/react`) | 12 | The canvas: pan/zoom, dragging, resizing, selection, connection handles, minimap. Building our own would be months of work. |
| [Zustand](https://zustand.docs.pmnd.rs) | 5 | The diagram store and file store. Tiny, no providers, and the store is readable outside React (`getState()`), which keyboard shortcuts, exports and the error page rely on. |
| Tailwind CSS | 4 | Styling with the dark-mode `dark:` variant and `pointer-coarse:`/`pointer-fine:` variants for touch. |
| `next-themes` | 0.4 | Light/dark theme with no flash on load. |
| `html-to-image` | 1.11 | Turns the live React Flow DOM into a canvas (PNG/PDF) or SVG for export. |
| `jsPDF` | 4 | Builds PDFs from the rendered canvases. |
| Vitest | 5 | Unit tests (`tests/`), in a Node environment. |

No other runtime dependencies. The ZIP writer for "one file" exports is ~100 lines of our own code
(`src/lib/zip.ts`) rather than a library; see the [decision log](17-decision-log.md#zip-without-a-dependency).
