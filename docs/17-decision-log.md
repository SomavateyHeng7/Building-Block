# 17. Decision log

Each entry: the situation, what we decided, what else we considered, and what follows from it. Newest concerns are
not necessarily last; entries are grouped by area. Add an entry when you make a decision someone might later
want to reverse.

---

## Product and data

### No server; the user's file is the only copy

- **Context:** architects draw internal systems; uploading them needs security approval.
- **Decision:** no backend, no accounts, no diagrams in browser storage. Open/Save a `.json` file like draw.io's
  device storage.
- **Alternatives:** cloud storage with accounts (blocked by security reviews, needs a backend); keeping diagrams in
  `localStorage` (what earlier versions did: invisible copies on shared machines, lost when storage is cleared, and
  "is my work saved?" was unclear).
- **Consequences:** reloads lose unsaved work, so every exit path warns (principle 3); autosave only where the File
  System Access API can write in place; the legacy page migrates old browser copies out.

### Repair files instead of rejecting them

- **Decision:** `parseDiagram` fixes what it can and reports each fix; it only throws for input that isn't a
  diagram at all.
- **Why:** a file with one bad connection is still the user's work. Rejecting it would leave them stuck.

### Ids are short random strings, unique per diagram

- `prefix_8chars` is readable in files and diffs. Global uniqueness isn't needed; copies always get new ids.

---

## State and undo

### Zustand, readable outside React

- **Alternatives:** React context (re-renders everything, not readable from plain functions), Redux (more code).
- **Why:** keyboard handlers, exports, the file module and the editor error page all need `getState()` outside
  React, and the editor error page must still reach the diagram after React has crashed.

### Undo stores whole immutable diagrams

- **Alternatives:** command pattern with inverse operations, or patches.
- **Why:** diagrams are small; snapshots make undo exact with no inverse logic to get wrong, and the same identity
  makes dirty tracking an `!==` check.

### Coalesce bursts into one undo step

- Drags, typing and colour-picker drags fire dozens of updates; a coalesce key plus an 800 ms window turns each
  burst into one step. **Sorted ids** in `historyKey` so the drag and its re-parent share a key.

### Undo restores the exact earlier object

- **Before:** undo made a copy with a new `updatedAt`, so undoing back to the saved state still showed "Unsaved
  changes".
- **Decision:** `restore()` puts back the same object. Undo-to-saved is clean.

### Navigation is not an edit

- **Before:** switching tabs created a new diagram object, so it showed "Unsaved changes" and triggered autosave.
- **Decision:** dirty tracking compares every top-level field except `activeSectionId` and `activeDetailId` by
  identity; tab switches and opening an internal design aren't undo steps.
- **Alternative:** keeping navigation outside the diagram. Rejected because files should reopen where they were
  saved, and undo should return to the tab where a change happened.

### No-op edits aren't recorded

- Renaming to the same name (or clicking into a label and away) used to add an undo step. `updateNodeLabel` and
  `renameSection` now return the state unchanged.

---

## Canvas and layout

### React Flow, controlled by the store

- **Why React Flow:** pan/zoom, drag, resize, selection, handles and minimap would be months of work.
- **Why controlled:** one source of truth makes undo, autosave and dirty tracking cover every change.

### Keep React Flow's node objects, and mount only what's on screen

- **Problem:** dragging on big diagrams ran at 3–7 fps (1,000–2,000 components a tab). Every frame handed React Flow a
  new object for every node without `measured`, so it forgot where every node's connection dots were: every
  connection on the tab unmounted and remounted (about 5,000 SVG elements a frame), measuring its label each time.
  Each container also scanned every node to find how far its contents reach.
- **Decision:** `toFlowNodes` reuses a node's flow object while it's unchanged and gives its size as `measured`;
  `fromFlowNodes` keeps unchanged diagram nodes (so undo history shares them); `contentExtents` works out every
  container's contents in one pass per nodes array; the canvas sets `onlyRenderVisibleElements`.
- **Consequence:** off-screen nodes aren't in the DOM, so export turns full rendering on while it pictures the canvas
  (`useRenderEverything`) and waits for the nodes and connections to be on the page, not for React Flow's
  measurements (sizes are known up front now).

### One level of container nesting

- L0 groups systems into domains; deeper structure belongs in L2. Keeps every layout calculation simple.

### Components can leave containers

- **Before:** nested nodes had React Flow's `extent: "parent"`, which clamps them inside their parent while dragging,
  so a component could never be dragged out, and cut/paste put it back in the same container.
- **Decision:** no `extent`; when a drag ends, `dropIntoContainers` puts each component in the top-most container
  under its **centre**, or none, clamped clear of the header, growing the container.
- **Why the centre:** "any overlap" made leaving impossible (it still overlaps while you drag it out) and made
  components jump into neighbours they barely touched.
- **Consequence:** while dragging, a component can be drawn outside its container; it settles on drop. Resizing a
  component past its container's edge now grows the container (the clamp used to prevent that).

### Arranging respects containers

- **Before:** aligning a container with its own component moved the component twice; aligning a nested component
  with an outside one put it outside its container while still "inside" it.
- **Decision:** selected containers carry their children; results settle with `dropIntoContainers`, the same rule
  as dragging.

### Paste and duplicate grow containers

- Same principle: containers never clip their components.

### Shortcuts aren't blocked by focused buttons

- **Before:** the shortcut handler ignored keys while a `<button>` had focus, so Ctrl+Z did nothing right after
  clicking Undo.
- **Decision:** only text inputs, `contenteditable`, dialogs and menus suppress shortcuts.

---

## Files and saving

### Guard the start pages, not just the editor

- **Context:** the App Router can't intercept the browser's Back button, and `beforeunload` doesn't fire for
  client-side navigation. After Back, the diagram is still in memory.
- **Decision:** `/diagrams` and `/templates` run the same Save / Don't save / Cancel guard (`useUnsavedGuard`)
  before replacing the diagram.

### Two-step "Saved — Open…"

- **Context:** browsers only show file pickers right after a click, and Chrome consumes that permission when a
  picker opens. "Save as (picker) then Open (picker)" from one click failed.
- **Decision:** when saving needed its own picker, the dialog asks for one more click to open.

### Revoke download URLs after 60 seconds

- Safari can still be starting a download after `click()` returns; revoking immediately could break it.

### Sanitise file names

- Remove characters Windows/macOS forbid, avoid Windows reserved names, keep accented letters, cap length.

---

## Levels

### The roadmap is computed from the code

- `levels.ts` lists the store actions each level needs; shipping them flips the landing page. No hand-edited
  status to forget.

### L2 lives inside the component, one level deep

- **Alternatives:** separate linked diagram files (break on rename/move; browsers can't open a linked file without
  a picker), or unlimited nesting (rarely needed, complicates navigation).
- **Decision:** `BlockNodeData.detail = { nodes, edges }`, one level, absent until used.
- **Consequence:** files with large internal designs grow; copying a component copies its design.

### Sequence diagrams are a kind of tab, offered as a template

- **Alternatives:** a separate kind of file (can't sit beside the L0 it explains), or a sequence behind each
  connection (limited to the two ends).
- **Decision:** `DiagramSection.kind = "sequence"` with the content in `sequence`, `nodes` left empty. Offered as
  the "Sequence diagram" template and as "Sequence" next to "Add tab". Participants are free-standing but take
  legend colours, so they read like the components they stand for.
- **Layout is computed, not stored:** messages are ordered steps, so positions would only drift out of order.

### Import draw.io for architecture, Mermaid for sequences

- **Why split by type:** draw.io files carry positions, containers and colours, so architecture keeps its layout;
  Mermaid flowcharts have no positions and would need an auto-layout step. Mermaid's `sequenceDiagram` is how most
  people already write sequences, and maps directly onto steps.
- **Lossy on purpose, and says so:** nested containers are lifted (one level here), groups dissolved, free text and
  loose arrows left out, `loop`/`alt` blocks flattened. Each import lists what it changed in its toast.
- **Fill colours become "Imported #…" categories** rather than matching default categories by colour, which would
  give shapes a meaning nobody chose. A later import reuses them.
- **Our own XML reader** (`xml.ts`), not DOMParser: imports then run the same in the browser and in unit tests.
- **Everything goes through `parseDiagram`** afterwards, so an import can never break an invariant.

### Sequence tabs as Mermaid code too

- People who write sequences in Mermaid can edit a tab as code beside the sheet, and copy or download it. The code
  is the left panel on sequence tabs (replacing the participant palette), and the sheet is drawn in Mermaid's look,
  so a sequence tab reads as Mermaid rather than as another architecture canvas. It's one
  model with two views: the code is generated from the sequence and applied back to it (one undo step), not stored.
- **Applying keeps what Mermaid can't say** (colours, descriptions, links to components) by matching participants by
  name. **Protocol** has no Mermaid syntax, so it's written in brackets after the message, as the sheet shows it;
  only the code view reads brackets back as a protocol (imports from elsewhere keep them in the text).

### "The active section" means the active view

- Making `getActiveSection` return an internal design when one is open made every existing action work at L2
  without touching them. View objects are cached so selectors stay stable.

---

## Export

### A dialog instead of a menu

- **Context:** people wanted "one file or many, as they like", across formats and views.
- **Decision:** a dialog with formats (multi-select), views, style and one-file/separate, plus a summary of exactly
  what will download. Choices are remembered.

### Pictures from the live page

- **Alternative:** re-implementing the diagram in canvas or SVG drawing code (two renderers to keep identical).
- **Decision:** `html-to-image` on the real React Flow DOM, at zoom 1, stepping through views and switching the theme
  while rendering.
- **Consequence:** exports briefly change what's on screen; colours that come from CSS variables don't survive, so
  edge colours are explicit.

### Cap canvas size for iOS

- iOS Safari silently produces blank canvases above ~16.7 MP; `exportPixelRatio` keeps under it.

### ZIP without a dependency

- **Alternatives:** JSZip or fflate.
- **Decision:** a ~100-line store-only writer. PNG/PDF don't compress further; no dependency to audit or update.
  Tested against `unzip` and Python's `zipfile`.

### Protect CSVs against formula injection

- Shared files mean exported labels come from other people; prefix risky cells with `'`.

---

## Privacy and UI

### Consent gate on app pages, versioned, stored locally

- **Decision:** accept once on `/diagrams`, `/templates`, `/editor`; stored with the notice version; withdrawable;
  public pages stay open. Forms ask separately and record what was agreed.
- **Why local:** there's no server to record it on, and nothing personal is collected by the app itself.

### Forms through configurable providers

- No backend, so the waitlist form POSTs to a URL set at build time. Unset means fully offline.
- The contact page gives an email address instead of a form (October 2026): people write from their own email, so
  no form provider holds their details, and there's nothing to set up beyond the address.

### Visit counts from Cloudflare Web Analytics, not an admin page in the app

- **Need:** see how many people use the site. **Constraint:** no server-side storage, and the host wasn't chosen
  yet. **Decision:** Cloudflare Web Analytics: free, cookieless, no personal data kept, works on any host; the
  dashboard is the admin view. Loaded only with a token, only in production, and not for GPC or Do Not Track.
- **Alternatives:** our own counts and `/admin` page (needs a server and a database); a third-party script with its
  own login (Plausible, Umami, GoatCounter). The privacy notice and consent text no longer say "no analytics".

### A plans page before anything is for sale

- `/pricing` shows Free today and planned paid tiers as *Coming soon*, from `src/lib/plans.ts`, with *Notify me* on
  the waitlist. Launching a plan is a price, a status and a payment link in that file; no payments code until then.

### One toast system with writing rules

- Errors stay until dismissed, repeats replace, timers pause on hover/focus, success names the file.

### A named colour palette

- Native colour inputs gave no guidance; categories ended up with near-identical colours. A curated, named palette
  marks colours already used, with custom colours still available.

### Collapsible panels with rails

- Collapse buttons sit on each panel's first title line; a collapsed panel leaves a 40 px rail with the expand
  button, so there is always a way back.

### Text colour on a colour by WCAG contrast

- A brightness cut-off put light text on mid tones (goldenrod, rose) at about 3:1. `readableTextOn` now picks
  whichever of dark or light text has more contrast, so every default legend colour reads at 4.5:1 or better
  (tested), and the start page and template previews use it too. The technology line isn't faded any more: at 75%
  it fell below 4.5:1; its smaller size sets it apart.

### The tab list holds only tabs

- Screen readers expect a tab list to contain tabs. Rename, duplicate and delete for the open tab, and adding or
  comparing tabs, sit in a "Tab actions" group just after the tabs, rather than inside the open tab.

---

## Operations and security

### Maintenance via the proxy: rewrite with 503

- Rewrite keeps the requested URL so the page can reload into it; 503 on every page (including `/maintenance`) is
  what the page polls for; the bypass token becomes an HttpOnly cookie and leaves the URL.

### A nonce-based Content-Security-Policy, with pages rendered per request

- **Context:** clickjacking, sniffing, referrer and permissions headers were set; scripts weren't restricted, so any
  HTML-injection bug (say, in a future import path) would run code. Next.js and `next-themes` write inline scripts.
- **Decision:** the proxy sets `script-src 'self' 'nonce-…' 'strict-dynamic'` with a fresh nonce per request, and
  every page renders per request so Next.js can put that nonce on its scripts (see
  [Security](14-security.md#content-security-policy)).
- **Alternatives:** `'unsafe-inline'` scripts (keeps pages static, but an injected script runs, which is what the
  policy is for); Next.js's experimental SRI (covers bundled scripts only, so the inline ones would still be
  blocked); hashing each page's inline scripts after the build (fragile, custom tooling).
- **Consequences:** pages are no longer pre-rendered; a few ms of server rendering per page view. Styles keep
  `'unsafe-inline'` (React's `style` attributes). Each new external origin must be added in `src/lib/csp.ts`.
  HSTS (host-dependent, hard to undo) is still left for later.

### Tests in `tests/`, mirroring `src/`

- Keeps shipped code and tests apart; imports use `@/`.
