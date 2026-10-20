# 10. Export

Files involved:

| File | Role |
| --- | --- |
| `src/components/editor/ExportDialog.tsx` | The dialog: what, which views, style, one file or several |
| `src/lib/diagram/exportPlan.ts` | Pure: which views exist, which files a choice produces, their names |
| `src/components/editor/Toolbar.tsx` (`runExport`) | Orchestration: steps through views, renders, bundles, downloads |
| `src/lib/diagram/export.ts` | Rendering pictures (PNG canvas, SVG), PDF, CSV rows |
| `src/lib/zip.ts` | The `.zip` writer |
| `src/lib/diagram/file.ts` (`downloadBlob`, `fileBaseName`) | Downloading and file names |

## What people can export

| Format | Covers | Typical use |
| --- | --- | --- |
| **PNG** | One picture per chosen view | Slides, documents |
| **SVG** | One per chosen view | Sharp at any size; title and legend are real text |
| **PDF** | One file with a page per view, or one file per view | Printing, sharing |
| **Component list (CSV)** | The whole diagram | The solution document's component catalogue |
| **Connection list (CSV)** | The whole diagram | Interface lists |
| **Diagram file (JSON)** | The whole diagram | A copy to open again |

A *view* is a tab or a component's internal design. Pictures include a **title** above and a **legend** below
listing **only the categories used in that view**.

## The export dialog — `ExportDialog.tsx`

1. **Formats:** pick any number. Pictures (PNG, SVG, PDF) and "Lists and files (always the whole diagram)".
2. **What to picture** (only when a picture format is chosen): every tab, with its internal designs indented
   under it. Empty views are disabled. **Only this view** / **Everything** shortcuts. The view on screen is tagged
   "On screen" and selected by default (or everything, if the view on screen is empty).
3. **Picture style:** light or dark.
4. **Download as** (only when it makes a difference): **One file** (a `.zip`, or a single PDF with a page per view)
   or **Separate files** (one download each, with a note that the browser may ask to allow several downloads).
5. **Summary:** "You'll get plan.zip (3 PNG images and the component list)." The button says exactly what it will
   download ("Download plan.zip", "Download 4 files"). If something is missing, the summary says what ("Choose at
   least one format") and the button is disabled.

The last formats, bundle choice and style are remembered in `localStorage["bb:export"]` (the older
`bb:exportTheme` key is still read once for the style).

**Why a dialog instead of a menu:** people asked to download "one file or many according to their liking".
That's a combination of choices (formats × views × bundling) that a flat menu couldn't express, and the summary
removes the guesswork about what will arrive.

## Planning — `exportPlan.ts`

`exportViews(diagram)` lists every view in order (each tab, then its components' internal designs) with a file
stem: `plan` (single tab), `plan-current` (several tabs), `plan-current-orders-internal` (an internal design).

`planExport(diagram, { views, formats, bundle })` returns the files:

| Format | Files |
| --- | --- |
| PNG, SVG | One per non-empty chosen view: `<stem>.png` |
| PDF | Bundled (or a single view): **one** PDF with a page per view, `<diagram>.pdf` (or `<stem>.pdf` for one view). Separate: one per view. |
| Component list | `<diagram>-components.csv` |
| Connection list | `<diagram>-connections.csv` |
| Diagram file | `<diagram>.json` |

Then: names that collide (e.g. two tabs both called "Current") are numbered (`-2`); and when bundling and there
is more than one file, `zipName` is `<diagram>.zip`. **Why a PDF counts as one file:** a multi-page PDF already
is "one file", so a PDF-only export never needs a zip.

`describeFiles(files)` writes "3 PNG images, 1 PDF and the component list" for the dialog and the toast.

This module is pure and fully tested (`tests/lib/diagram/exportPlan.test.ts`).

## Running an export — `runExport` in `Toolbar.tsx`

```mermaid
sequenceDiagram
  participant D as ExportDialog
  participant T as Toolbar.runExport
  participant S as store
  participant R as export.ts
  D->>T: choice {formats, views, bundle, theme}
  T->>T: planExport(); save prefs
  T->>T: clear selection (no handles/highlights in pictures)
  T->>T: switch the app to the chosen theme (inTheme)
  loop each pictured view
    T->>S: setActiveSection / openDetail
    T->>T: waitForSection (nodes rendered and measured)
    T->>R: renderComposite (PNG/PDF) and/or renderSvg
  end
  T->>T: restore theme
  T->>R: canvasToPng / pdfFromPages / CSV / JSON blobs
  alt zipName
    T->>T: createZip → one download
  else
    T->>T: download each, 400 ms apart
  end
  T->>S: put back the view that was open
  T->>T: toast "Downloaded plan.zip"
```

Why each step:

- **Pictures are taken from the live page.** `html-to-image` serialises the real React Flow DOM, so what's
  exported is exactly what's drawn. That means the app must be *showing* each view, and in the chosen theme:
  - **Stepping through views:** the canvas only renders one view, so the export opens each in turn and waits two
    animation frames at a time (up to 40 tries) until React Flow has rendered and measured every node.
  - **Theme:** `inTheme` switches `next-themes` to the export style, waits until `<html>` has (or loses) the
    `dark` class, renders, then restores the user's theme (including "system").
- **Each view is rendered once**, even if PNG and PDF are both wanted.
- **Data formats don't touch the canvas**, so a CSV-only export is instant and doesn't flicker.
- **400 ms between separate downloads:** browsers drop downloads fired back to back.
- **Afterwards** the original tab and internal design are reopened, even if the export failed (`finally`).
- **Errors** show "Couldn't export" with advice to save the diagram so work is safe.

## Rendering — `export.ts`

### `renderComposite(options)` → canvas (for PNG and PDF)

1. Size = the nodes' bounds + 40 px padding on each side.
2. `toCanvas(viewport, …)` with a CSS transform that moves the bounds to the padding at **zoom 1**, whatever the
   user's zoom, so exports are always full size. A `filter` leaves resize handles and connection dots out.
3. Draws onto a new canvas: background, the **title** (bold 18 px), the diagram, then the **legend** ("LEGEND",
   swatches and names, wrapping at the image width, minimum width 480 px so a short legend still fits).
4. **Resolution — `exportPixelRatio(width, height)`:** 2× for sharpness, reduced so the canvas stays under 12,000 px
   per side **and** under ~16.7 million pixels in total. **Why the area limit:** iOS and iPadOS Safari refuse larger
   canvases and silently export a blank image; a 3000×2000 diagram at 2× (24 MP) was already over.

Fonts are plain Arial/Helvetica for the title and legend so they look the same everywhere.

### `renderSvg(options)` → SVG

An outer SVG with the **title and legend as real `<text>` and `<rect>` elements** (editable in a vector editor),
and the diagram embedded as a nested SVG image from `html-to-image`'s `toSvg`. All text is XML-escaped. **Why
nested:** converting React Flow's HTML boxes into native SVG shapes would be a large project; this keeps the
export sharp and the title/legend editable.

### `pdfFromPages(pages)` → PDF

jsPDF, **one page per picture, each page sized to its picture** (landscape or portrait), so nothing is scaled down
or cropped onto A4.

### CSV — `componentRows`, `connectionRows`, `toCsv`, `csvCell`

- Every tab, then each component's internal design right after it (`viewsOf`). The **Part of** column names the
  component whose internal design a row is in (empty for tab rows).
- Components: Section, Part of, Type, Name, Container, Category, Technology, Owner, Description, Notes.
- Connections: Section, Part of, From, To, Direction, Line, What flows, Protocol or technology, Description.
- Every cell is quoted with quotes doubled; rows end in CRLF; the file starts with a **UTF-8 byte-order mark** so
  Excel reads accents correctly.
- **Formula injection:** a cell starting with `=`, `+`, `-`, `@`, tab or carriage return gets a leading apostrophe,
  so Excel and Sheets show it as text instead of running it. **Why it matters:** diagram files are shared, so a
  label like `=HYPERLINK(…)` from someone else's file could otherwise run when the CSV is opened.

The `*Rows` functions return arrays (tested); `componentsCsv`/`connectionsCsv` wrap them in Blobs.

### The ZIP writer — `src/lib/zip.ts`

`createZip(entries)` writes a standard `.zip`: local file headers, a central directory, and the end record. Files
are **stored** (not compressed); names are flagged UTF-8 (bit 11) so "café.png" survives; CRC-32 is computed with
the standard table; timestamps are MS-DOS local time. The test writes a zip and checks it with the system `unzip
-t` (CRCs) and Python's `zipfile` (names and contents).

**Why store, not deflate:** PNG and PDF are already compressed, so deflate would save little; storing keeps the
writer ~100 lines with no dependency. See the [decision log](17-decision-log.md#zip-without-a-dependency).

**Note for testers:** macOS's built-in `unzip` is compiled without Unicode support and shows accented names
garbled (`caf+�`). The file is fine; Finder, Windows and Python show the name correctly.
