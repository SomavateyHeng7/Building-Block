# 15. Testing and QA

## Running the checks

```bash
pnpm test        # Vitest: every file in tests/
npx tsc --noEmit # type check
pnpm lint        # ESLint (Next.js core-web-vitals + TypeScript rules)
pnpm build       # production build (also type-checks)
```

All four must pass before merging.

## Layout of the test suite

Tests live in **`tests/`**, in folders that mirror `src/`: `src/lib/diagram/store.ts` is tested in
`tests/lib/diagram/…`. They import the code with the `@/` alias (`import { parseDiagram } from
"@/lib/diagram/validate"`). Vitest only looks in `tests/` (`vitest.config.mts`), and runs in a **Node**
environment: no browser, so tests cover the pure logic and the stores.

**Why a separate folder:** keeps `src/` to shipped code only, and makes the suite easy to find and run as a whole.

| File | Tests | What it proves |
| --- | --- | --- |
| `tests/lib/diagram/validate.test.ts` | 21 | File parsing: rejects non-diagrams and newer versions; every repair rule; short colours; size caps |
| `tests/lib/diagram/file.test.ts` | 17 | Dirty tracking (incl. tab switches and undo-to-saved); save via picker, reuse of the handle, Save As, cancel, failure; `fileBaseName` cases |
| `tests/lib/diagram/connections.test.ts` | 23 | Connections: creating, refusing, editing, deleting with components, copying; paste/duplicate growing containers; no-op renames; `historyKey`; `defaultLabel` |
| `tests/lib/diagram/layout.test.ts` | 21 | Align/distribute/size (incl. containers carrying children and leaving containers), grow/fit, next slot, nudging, `dropIntoContainers` |
| `tests/lib/diagram/detail.test.ts` | 14 | L2: drawing inside a component, back, navigation isn't an edit, undo, emptying, one level deep, copying, legend removal, stable view objects, file round-trip, nested-design repair, CSV "Part of", export titles |
| `tests/lib/diagram/exportPlan.test.ts` | 8 | Views and file names; single file vs zip; PDF pages vs files; empty views skipped; name collisions; descriptions |
| `tests/lib/diagram/export.test.ts` | 6 | CSV quoting and formula injection; BOM and CRLF; pixel ratio within iOS canvas limits |
| `tests/lib/diagram/palette.test.ts` | 11 | Palette has no duplicates; default legend colours are named; next colour; parsing typed colour codes |
| `tests/lib/zip.test.ts` | 3 | CRC-32 against the standard value; the zip passes `unzip -t` and Python's `zipfile` (UTF-8 names, contents); empty zip |
| `tests/lib/consent.test.ts` | 4 | Needed until accepted; version mismatch asks again; withdraw; blocked storage lasts for the session |
| `tests/lib/toast.test.ts` | 4 | Durations by kind; repeats replace; at most three; empty details |
| `tests/lib/maintenance.test.ts` | 6 | Reading the environment; `Retry-After`; upcoming end time |
| `tests/proxy.test.ts` | 2 | 503 on every page during maintenance (incl. `/maintenance`); redirect home afterwards |
| `tests/lib/levels.test.ts` | 2 | Roadmap statuses and heading wording |

`zip.test.ts` shells out to `unzip` and `python3`, which are present on macOS and most Linux CI images.

### Writing a test

- Put it under `tests/` in the folder matching the source file; name it `<module>.test.ts`.
- Store tests: reset with `useDiagramStore.getState().loadDiagram(createBlankDiagram())` in `beforeEach`.
- Code touching `window`: stub it (`vi.stubGlobal("window", {...})`); see `consent.test.ts` for a fake
  `localStorage`, and `file.test.ts` for fake file handles.
- Prefer testing the pure function (e.g. `planExport`, `componentRows`) over the component that uses it.

## What automated tests don't cover

The UI components aren't unit-tested (there is no browser environment in the suite). These are checked by hand,
in **Chrome or Edge** *and* **Safari or Firefox**, plus a phone, before a release:

### Manual checklist

**Starting and saving**
- [ ] First visit to `/diagrams` shows the privacy notice; Accept needs the box ticked; Not now goes home.
- [ ] Withdraw on `/privacy`, then `/diagrams` asks again.
- [ ] New diagram → add something → Save (Chrome: picker, then "Saved · name.json"; Safari/Firefox: a download).
- [ ] Chrome: edit → status shows "Unsaved changes" → about a second later it saves by itself.
- [ ] Open a file, drop a file on the start page; a broken file shows a warning with repairs.
- [ ] Unsaved work → browser Back → New blank diagram → asked to save.
- [ ] Never-saved diagram → File → Open → Save as… → choose a place → "Saved — Open…" → choose a file.
- [ ] Reload with unsaved changes → the browser's leave warning.

**Editing**
- [ ] Drag components into, out of, and between containers; several at once; one Ctrl+Z undoes it.
- [ ] Click Undo, then press Ctrl+Z: it undoes again. Arrow keys nudge after clicking Align.
- [ ] Select a container and one of its components, Align: the component stays inside.
- [ ] Paste into a container several times: it grows.
- [ ] Switch tabs: status stays clean.
- [ ] Rename a tab, a component (double-click) and press Esc: name unchanged. Arrow keys move between tabs.
- [ ] Connections: drag from a dot; "Connect to…"; edit; delete a component deletes its lines.
- [ ] L2: Design its internals, draw, connect, Back, Esc; L2 badge opens it; reopen the saved file inside it.
- [ ] Legend: colour picker by mouse and keyboard; "used by" dots; custom code; remove an entry in use asks first.
- [ ] Collapse both side panels; reload: still collapsed.

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

A full QA pass (code review, executable probes, a production-server HTTP check and a dependency audit) found and
fixed, among others: Back-button data loss, components stuck inside containers, Save-then-Open picker failures,
align/paste pushing components out of containers, shortcuts blocked after clicking buttons, tab switches marking
the diagram unsaved, CSV formula injection, the maintenance-page reload loop, blank iOS exports, and several
smaller issues. The reasoning behind each fix is in the [decision log](17-decision-log.md).
