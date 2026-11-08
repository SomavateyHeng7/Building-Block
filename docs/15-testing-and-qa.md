# 15. Testing and QA

## Running the checks

```bash
pnpm test        # Vitest: every file in tests/
npx tsc --noEmit # type check
pnpm lint        # ESLint 10 (Next.js core-web-vitals + TypeScript rules)
pnpm build       # production build (also type-checks)
pnpm perf        # performance baselines on big diagrams (not part of pnpm test)
pnpm audit       # known vulnerabilities in dependencies
```

The first four run in CI (`.github/workflows/ci.yml`) and must pass before merging. Browser tests run separately,
in TesterArmy, against a deployed copy of the app (see [Browser tests](#browser-tests-testerarmy)).

**ESLint 10 and three plugins:** `eslint-plugin-react`, `-jsx-a11y` and `-import` (pulled in by
`eslint-config-next`) don't list ESLint 10 as supported yet. Their rules were checked to run on it, and
`pnpm.peerDependencyRules` in `package.json` allows it for those three only; drop the rule once they list it.

## Layout of the test suite

Tests live in **`tests/`**, in folders that mirror `src/`: `src/lib/diagram/store.ts` is tested in
`tests/lib/diagram/…`. They import the code with the `@/` alias (`import { parseDiagram } from
"@/lib/diagram/validate"`). Vitest only looks in `tests/` (`vitest.config.mts`), and runs in a **Node**
environment, so most tests cover the pure logic and the stores. Component tests live in `tests/components/*.test.tsx`
and opt in to a browser-like environment with `// @vitest-environment jsdom` on their first line (React Testing
Library and jsdom are dev dependencies).

**Why a separate folder:** keeps `src/` to shipped code only, and makes the suite easy to find and run as a whole.

| File | Tests | What it proves |
| --- | --- | --- |
| `tests/lib/diagram/validate.test.ts` | 24 | File parsing: rejects non-diagrams and newer versions; every repair rule; short colours; size caps |
| `tests/lib/diagram/file.test.ts` | 21 | Dirty tracking (incl. tab switches, undo-to-saved, and a never-saved sequence diagram counting as something to lose); save via picker, reuse of the handle, Save As, cancel, failure; `fileBaseName` cases |
| `tests/lib/diagram/connections.test.ts` | 27 | Connections: creating, refusing, editing, deleting with components, copying; paste/duplicate growing containers; no-op renames; `historyKey`; `defaultLabel` |
| `tests/lib/diagram/layout.test.ts` | 22 | Container content extents (computed once per nodes array); align/distribute/size (incl. containers carrying children and leaving containers), grow/fit, next slot, nudging, `dropIntoContainers` |
| `tests/lib/diagram/detail.test.ts` | 15 | L2: drawing inside a component, back, navigation isn't an edit, undo, emptying, one level deep, copying, legend removal, stable view objects, file round-trip, nested-design repair, CSV "Part of", export titles |
| `tests/lib/diagram/levelTools.test.ts` | 14 | L0 landscape summary by category, L1 suggestions (used first, case-insensitive, inside designs), async protocols, protocol chips, newest protocol on new connections (not on flowcharts), L2 neighbours, "Connected at L1" context (one undo step, once only, reused container, fits, clean file) |
| `tests/lib/diagram/exportPlan.test.ts` | 8 | Views and file names; single file vs zip; PDF pages vs files; empty views skipped; name collisions; descriptions |
| `tests/lib/diagram/export.test.ts` | 6 | CSV quoting and formula injection; BOM and CRLF; pixel ratio within iOS canvas limits |
| `tests/lib/diagram/palette.test.ts` | 14 | WCAG contrast; every default legend colour has 4.5:1 text; palette has no duplicates; default legend colours are named; next colour; parsing typed colour codes; draw.io outlines for its fills, darkened outlines for others |
| `tests/lib/zip.test.ts` | 3 | CRC-32 against the standard value; the zip passes `unzip -t` and Python's `zipfile` (UTF-8 names, contents); empty zip |
| `tests/lib/consent.test.ts` | 4 | Needed until accepted; version mismatch asks again; withdraw; blocked storage lasts for the session |
| `tests/lib/toast.test.ts` | 4 | Durations by kind; repeats replace; at most three; empty details |
| `tests/lib/maintenance.test.ts` | 6 | Reading the environment; `Retry-After`; upcoming end time |
| `tests/proxy.test.ts` | 4 | 503 on every page during maintenance (incl. `/maintenance`); redirect home afterwards; a fresh CSP nonce per page, handed to the page, maintenance page included |
| `tests/lib/csp.test.ts` | 3 | The policy: nonce and `'strict-dynamic'` scripts; eval only in development; HTTPS upgrade; waitlist and analytics hosts, ignoring endpoints that aren't `https://` |
| `tests/lib/levels.test.ts` | 2 | Roadmap statuses and heading wording |
| `tests/lib/diagram/compare.test.ts` | 13 | Compare tabs: matching by name across ids, added/removed/changed fields, container moves, ignoring layout, connection matching (incl. two-way), internal designs, change-list rows |
| `tests/templates/templates.test.ts` | 40 | Every template opens without repairs, mints fresh ids, connects real components, fits its containers; horizontal lanes (valid, fit, in flow order, one step per spot); the richer templates have connections, an L2 design and several tabs |
| `tests/templates/filter.test.ts` | 5 | Template search (any order, case and accents ignored, every word must match), category filter, every template has a known category |
| `tests/lib/recentTemplates.test.ts` | 4 | Newest first, no repeats, at most three; damaged values ignored; blocked storage lasts for the tab |
| `tests/lib/diagram/search.test.ts` | 9 | Names first, then details; several words in any order; accents ignored; a changed diagram is searched afresh; highlighting; sequence participants, messages and notes |
| `tests/lib/diagram/sequence.test.ts` | 11 | Editing and laying out sequences; sequence tabs (undo, duplicate, save, picture); picking a component for a participant, tab-safe |
| `tests/lib/diagram/flowAdapter.test.ts` | 6 | Line paths and bends; change marks; unchanged nodes keep their objects (undo history shares them) |
| `tests/lib/diagram/grouping.test.ts` | 11 | Grouping into a container and ungrouping, as one undo step; deleting a container asks about its components |
| `tests/lib/diagram/exportMermaid.test.ts` | 7 | Sequence → Mermaid (aliases, arrows, protocol, escapes, autonumber, indented frames, activation marks) and back to the same sequence; which line each item is on; applying keeps colours, descriptions and links; errors |
| `tests/lib/diagram/import.test.ts` | 14 | XML reading (incl. very deep nesting); draw.io shapes, swimlanes, arrows and compressed pages; parents that loop or nest deep; Mermaid sequences with frames and activations; character codes past Unicode; refusals with reasons |
| `tests/lib/diagram/sequenceFrames.test.ts` | 13 | Frames: wrapping steps, finding a frame from any marker, removing it whole, pairing markers up, moving within bounds, nested layout; activation bars and arrow ends; Mermaid round trip with nested frames, unclosed frames, colour boxes, activate lines, saved files; the code tokenizer; caption splitting |
| `tests/lib/diagram/hints.test.ts` | 6 | Check before you share: quiet when complete; missing owners, protocols and unconnected components; no "unconnected" flood before any connections; internal designs without owners; flowcharts checked only for unconnected steps; the Flowchart template has nothing to flag |
| `tests/lib/diagram/textBox.test.ts` | 8 | Text boxes: adding, line breaks and style, a saved file, no connections, not in the component list; in containers (dropped in, carried, dragged out, added in, left alone by Tidy, kept in a file, released when the container goes); exact position and size, minimum size, container growth |
| `tests/lib/diagram/guides.test.ts` | 15 | Pixel guides: snapping edges and middles within a threshold, resize snapping to edges and same width/height (with minimum sizes and Alt), guide lines, gaps to the nearest facing boxes, distances between and inside boxes, bounding boxes |
| `tests/templates/flowchart.test.ts` | 9 | The Flowchart template (pills, decisions with Yes/No, a title, Mermaid shapes, a saved file); shapes on blocks; the app's palette, quick add only on tabs with flowchart shapes, an old `look` ignored; dropping flowchart shapes in their categories; quick add (placement, stepping past boxes, one undo, Yes/No, "End") |
| `tests/lib/diagram/legend.test.ts` | 3 | Reordering entries; removing one moves its items to another, inside internal designs too |
| `tests/lib/diagram/recovery.test.ts` | 6 | Recovery copy: off by default, read back like a file, cleared, full or blocked storage reported |

`zip.test.ts` shells out to `unzip` and `python3`, which are present on macOS and most Linux CI images.

### Writing a test

- Put it under `tests/` in the folder matching the source file; name it `<module>.test.ts`.
- Store tests: reset with `useDiagramStore.getState().loadDiagram(createBlankDiagram())` in `beforeEach`.
- Code touching `window`: stub it (`vi.stubGlobal("window", {...})`); see `consent.test.ts` for a fake
  `localStorage`, and `file.test.ts` for fake file handles.
- Prefer testing the pure function (e.g. `planExport`, `componentRows`) over the component that uses it.

## Browser tests (TesterArmy)

The app is tested in a real browser by [TesterArmy](https://tester.army): an AI agent follows plain-language steps
in a cloud browser. The tests are defined in **`testerarmy/tests.mjs`** (45, one or more per area of the app, each on
a desktop, tablet or phone screen) and copied into TesterArmy with `pnpm testerarmy:sync`, so they're reviewed with
the code. Where the agent can't see or do something itself, a `javascript` step does it: hiding the native file
pickers and handing the app a file, recording downloads, reading CSS classes and browser storage, measuring contrast.

**It needs a public URL.** The cloud browser can't reach `localhost`, so tests run against a deployment (a Vercel
preview, say) or a tunnel to a local server.

### Setting it up (once)

1. Sign in: `pnpm exec ta auth`. Create a web project (or pick one: `pnpm exec ta projects list`) and a group:
   `echo '{"projectId":"<project>","name":"Regression"}' | pnpm exec ta groups create --json`.
2. Copy the tests in: `TESTERARMY_PROJECT_ID=<project> TESTERARMY_GROUP_ID=<group> pnpm testerarmy:sync`. Run it
   again after changing `tests.mjs`: it updates tests by title and lists any in the group that aren't in the file.
3. For CI, in the GitHub repository settings add the secret `TESTERARMY_API_KEY` (an API key from the TesterArmy
   dashboard) and the variables `TESTERARMY_PROJECT_ID` and `TESTERARMY_GROUP_ID`, and have the host report
   deployments to GitHub (Vercel's GitHub integration does).

`.github/workflows/testerarmy.yml` then runs the group against every successful deployment and fails if any test
fails; it can also be run by hand with a URL. Until the variables are set it's skipped.

### Running them by hand

```bash
TESTERARMY_URL=https://<preview-url> TESTERARMY_PROJECT_ID=<project> TESTERARMY_GROUP_ID=<group> pnpm test:browser
```

For a local build, start it (`pnpm build && pnpm start -p 3100`) and expose it with a tunnel, e.g.
`cloudflared tunnel --url http://localhost:3100`, then use the tunnel's URL. Keep the tunnel up only while testing:
it puts the local server on the internet.

### Writing a test

- One flow per test, 3–15 steps (TesterArmy allows 30): `act` for what to do, `assert` for what should be true.
  Name things as they appear on screen ("Click 'Compare tabs'"), not by selector.
- Accept the privacy notice first (the `consent` step) and open a template with `openTemplate(...)`.
- Use a `javascript` step only for what the agent can't see; return `{ success: false, reason }` to fail.
- Only what's on screen is in the DOM (the canvas uses `onlyRenderVisibleElements`): count nodes on templates
  that fit the screen, not on big diagrams.

## What automated tests don't cover

The unit tests run without a browser, and TesterArmy uses one Chromium browser. These are checked by hand, in
**Chrome or Edge** *and* **Safari or Firefox**, plus a real phone, before a release. Most need a real file system,
a real device or a deployment setting, which is why they're here:

### Manual checklist

**Starting and saving**
- [ ] First visit to `/diagrams` shows the privacy notice; Accept needs the box ticked; Not now goes home.
- [ ] Withdraw on `/privacy`, then `/diagrams` asks again.
- [ ] New diagram → add something → Save (Chrome: picker, then "Saved · name.json"; Safari/Firefox: a download).
- [ ] Chrome: edit → status shows "Unsaved changes" → about a second later it saves by itself.
- [ ] Open a file, drop a file on the start page; a broken file shows a warning with repairs.
- [ ] Unsaved work → browser Back → New blank diagram → asked to save.
- [ ] Never-saved diagram → File → Open → Save as… → choose a place → "Saved — Open…" → choose a file.
- [ ] Reload with unsaved changes → the browser's leave warning; for an architecture diagram **and a sequence diagram**.
- [ ] Leave anyway with recovery copies off → the start page says the diagram couldn't be brought back and offers to
      turn them on; with them on → reload → **Unsaved changes** offers to recover it.

**Editing**
- [ ] Drag components into, out of, and between containers; several at once; one Ctrl+Z undoes it.
- [ ] Click Undo, then press Ctrl+Z: it undoes again. Arrow keys nudge after clicking Align.
- [ ] Select a container and one of its components, Align: the component stays inside.
- [ ] Paste into a container several times: it grows.
- [ ] Switch tabs: status stays clean.
- [ ] Rename a tab, a component (double-click) and press Esc: name unchanged. Arrow keys move between tabs.
- [ ] Connections: drag from a dot; "Connect to…"; edit; delete a component deletes its lines.
- [ ] L2: Design its internals, draw, connect, Back, Esc; L2 badge opens it; reopen the saved file inside it.
- [ ] L2: **Ctrl+Enter (Windows) and ⌘+Enter (Mac)** on a clicked component open its design; Esc comes back with it
      selected. An empty design's "Start from its L1 neighbours" zooms to them and its toast's Undo removes them.
- [ ] L1: double-click a line's label, type both fields, Enter: one Ctrl+Z undoes it. On a phone (Edit mode) the
      editor stays on screen near the edges and the keyboard doesn't zoom the page.
- [ ] Legend: colour picker by mouse and keyboard; "used by" dots; custom code; remove an entry in use asks first.
- [ ] Collapse both side panels; reload: still collapsed.
- [ ] Drag a component near another: pink guides and an orange gap in px; it snaps; hold Alt to move freely. Arrow
      keys move 1 px (Shift 10) with the box focused or not. X/Y/W/H fields move and size it exactly.
- [ ] Resize a component by an edge strip (not the round dot) towards another's width: it snaps, pink size markers
      show on both, and the connection dots hide meanwhile; hold Alt to resize freely. Dragging the round dot still
      draws a connection.
- [ ] Select one box, hold Alt and point at another: the distances show.
- [ ] Drag a Text box in, double-click, write two lines: the box grows; Ctrl/⌘+Enter finishes.
- [ ] Flowchart template: hover a shape, click a blue arrow: a connected shape appears; drag Data/Database shapes
      from the palette. An L0 template shows no arrows.

**Sequence tabs**
- [ ] Type in the code: the sheet follows; a bad line goes red and stays after clicking away; the sheet keeps the
      last good drawing.
- [ ] Toolbar: add a participant, message (named in place), note, a Frame around a message; double-click to rename.
- [ ] Click a line of code: that item is selected on the sheet; select on the sheet: its line is highlighted.
- [ ] Details panel: change a frame's kind, add an "else" part, tick activation; Delete a frame keeps its steps.

**Export**
- [ ] PNG of one view; "One file" with several formats → a `.zip` opens in Finder/Explorer.
- [ ] "Separate files" with several views (Chrome may ask to allow multiple downloads).
- [ ] PDF of every view as one file: one page per view, internal designs included.
- [ ] Dark style export while the app is light: the app switches back afterwards.
- [ ] CSVs open in Excel with accents intact; a label starting with `=` shows as text.
- [ ] iPhone/iPad: PNG of a large diagram isn't blank.

**Everything else**
- [ ] Toasts: hover pauses them; errors stay; on a phone they're full width.
- [ ] `/contact`: validation messages; sending (with an endpoint) or opening the email app (address only).
- [ ] Maintenance mode on a preview deployment (see [operations](16-operations.md#maintenance-mode-runbook)).
- [ ] Phone: drawers open and close; tapping the palette adds; handles are visible; no zoom when typing.

## QA history

**6 November 2026:** QA of the L0/L1/L2 enhancements (landscape summary, connection suggestions, chips and typing on
the line, L1 context in internal designs, the camera following, level transitions). A 66-check Playwright pass on the
production build (desktop Chromium, dark mode, reduced motion, a phone in Chromium and WebKit) found and fixed:
**⌘+Enter didn't open an internal design on a Mac** (and Ctrl+Enter wouldn't on Windows): React Flow reads Enter on a
focused box as "select it" and, with its multi-select key held, unselected it first, so the shortcut is now handled on
the canvas before React Flow; **two quick edits typed on a line undid as one step**, so finished edits (the line
editor, protocol chips, "Use a dashed line") are now their own undo step (`updateConnection(…, { ownStep: true })`);
**the line editor ran off a phone screen** near the edge, so it is now kept inside the canvas; and, from before
these changes, **Esc out of an internal design didn't leave the component selected** as documented, because the same
key press then cleared the selection. Three browser tests were added (L0 summary, L1 typing/chips/last protocol, L2
shortcut/context/navigation) and walked locally, running their own `javascript` checks.

**4 November 2026:** after user testing found that resizing gave no sense of size against other blocks and that
grabbing an edge often drew an arrow instead, resizes now snap (edges, same width/height) and the resize controls
were restyled. A browser test was added ("Resizing a box snaps to another's width…"); its `javascript` steps fire
the resize with mouse events, so the snap is checked exactly. Walked locally with Playwright, with a regression pass:
connections from the dots, the edge strip next to a dot resizing rather than connecting, quick-add arrows, drag
guides, top-left corner resize and its undo, a component widened in a container, container handles on hover, text
box resize, dark mode and phone view mode. All passed.

**3 November 2026:** the browser tests caught up with text boxes, pixel-exact layout, flowcharts and the live
sequence editor. Three sequence tests still clicked the removed Apply and Undo edits buttons, or expected a new
message to be named in the code, and the templates list lacked the Flowchart; they were rewritten. Eight tests were
added (text boxes in containers, 1 px nudges and typed sizes, drag guides, quick add and a clean Check on the
Flowchart, the shape palette and no arrows on L0, frames and the sequence toolbar, the lost-changes notice, the start
page's width and real previews). Their steps were walked locally with Playwright, running each test's own
`javascript` checks, before syncing; TesterArmy itself needs a deployment to run against.

**October 2026:** a browser pass on Chrome, WebKit, a tablet and a phone (the former Playwright suite plus checks of
the newer features), an axe-core accessibility scan and a CPU profile of dragging on big diagrams found and fixed:
dragging at 3–7 fps on 1,000–2,000 components a tab (every connection remounted each frame), low-contrast text on
goldenrod and rose components, non-tab controls inside the tab list, an unnamed tab-rename field, a search row
below contrast, a button whose name didn't include its visible text, and the Next.js, DOMPurify, Vite and Zod
advisories. Undo history now shares unchanged nodes (13× fewer objects kept).


A full QA pass (code review, executable probes, a production-server HTTP check and a dependency audit) found and
fixed, among others: Back-button data loss, components stuck inside containers, Save-then-Open picker failures,
align/paste pushing components out of containers, shortcuts blocked after clicking buttons, tab switches marking
the diagram unsaved, CSV formula injection, the maintenance-page reload loop, blank iOS exports, and several
smaller issues. The reasoning behind each fix is in the [decision log](17-decision-log.md).
