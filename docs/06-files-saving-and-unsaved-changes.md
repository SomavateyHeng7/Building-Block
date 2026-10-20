# 6. Files, saving and unsaved changes — `src/lib/diagram/file.ts`

Diagrams are never stored by the app. A diagram exists in memory while it is open, and the user's `.json` file is
the only copy, like draw.io's "Device" storage. This module opens files, writes them, decides whether there are
unsaved changes, and holds the file store.

## The file store — `useFileStore`

| Field | Meaning |
| --- | --- |
| `opened` | A diagram has been started or opened this session. `false` after a reload, so `/editor` redirects to the start page. |
| `handle` | The `FileSystemFileHandle` Save writes to (Chrome, Edge, Opera only). `null` until the first save or when opened without the API. |
| `fileName` | Shown in the toolbar ("Saved · plan.json"). |
| `saved` | **The exact diagram object last written to a file.** `null` when never saved. |
| `saving` | A write is in progress (prevents overlapping writes). |
| `error` | The last write failed (stops autosave, shows "Not saved"). |

`startDiagram(diagram, file?)` makes a diagram the open one: loads it into the diagram store (clearing history)
and resets the file store. With `file` (opened from disk) it is clean; without (new or template) it has no file.

## Two kinds of browser

```ts
export function supportsFilePicker() {
  return typeof window !== "undefined" && !!window.showOpenFilePicker && !!window.showSaveFilePicker;
}
```

| Browser | Open | Save | Autosave |
| --- | --- | --- | --- |
| Chrome, Edge, Opera (desktop and Android) — **File System Access API** | `showOpenFilePicker`, keeps the handle | Writes back **in place**. First save asks where (`showSaveFilePicker`). | Yes, ~1 second after the last edit, once there is a handle |
| Safari, Firefox, iPad browsers | A hidden `<input type="file">` | **Downloads** a new `.json` every time | No (it would download a file every second) |

The types for the API are declared in `src/types/file-system-access.d.ts` because TypeScript's DOM library
doesn't include them yet. The UI adapts its wording: "Save as…" becomes "Download a copy", and the File menu and
start page explain that the browser can't save over a file.

## Saving — `saveDiagramToFile({ saveAs })`

1. Refuse if a save is already running.
2. Serialise the diagram **as it is now** (`JSON.stringify(diagram, null, 2)`, pretty so files diff well in git).
3. With the API: reuse the handle (or ask with `showSaveFilePicker` on first save / Save As), `createWritable()`,
   write, close. Without: download it.
4. On success: `saved = diagram` (the object captured in step 2), `error = false`.
5. Resolve `true` on success, `false` if the user cancelled the picker (`AbortError`, silent) or it failed.

On failure: log it, show **"Couldn't save the file"** (once, not on every autosave retry) with a **Save as…** button,
and set `error`. The toolbar then shows **Not saved** and autosave stops until a manual save succeeds.

**Why capture the diagram before writing:** if the user edits while the write is in progress, `saved` is the
older object, so the diagram is still dirty and autosave writes again. Nothing is marked saved that wasn't.

**File names — `fileBaseName(name)`:** lower-case, spaces and dashes become `-`, characters Windows or macOS forbid
(`<>:"/\|?*` and control characters) are removed, leading/trailing dots and dashes trimmed, at most 100 characters,
Windows reserved names (`CON`, `NUL`, `COM1`…) get `-diagram` appended, and an empty result becomes `diagram`.
Accented letters are kept. Examples are in `tests/lib/diagram/file.test.ts`.

**Downloads — `downloadBlob(blob, name)`:** an `<a download>` click. The object URL is revoked **60 seconds later**,
not immediately, because Safari can still be starting the download after `click()` returns.

## Autosave — in `EditorApp.tsx`

```ts
useEffect(() => {
  if (!opened || !handle || !dirty || saving || saveFailed) return;
  const timeout = setTimeout(() => void saveDiagramToFile(), AUTOSAVE_DELAY_MS); // 1000 ms
  return () => clearTimeout(timeout);
}, [opened, handle, dirty, diagram, saving, saveFailed]);
```

Each edit (new `diagram`) restarts the timer, so it writes once the user pauses. It only runs with a handle (the
File System Access API), and pauses after a failed write until the user saves manually, so a broken file doesn't
produce a stream of errors.

## Dirty tracking

```ts
function differsFromSaved(saved, diagram) {
  if (saved === diagram) return false;
  if (!saved) return hasContent(diagram);              // never saved: dirty once it has anything in it
  // Same object except which tab / internal design is showing → still clean.
  const keys = new Set([...Object.keys(saved), ...Object.keys(diagram)]);
  keys.delete("activeSectionId"); keys.delete("activeDetailId");
  return [...keys].some((key) => saved[key] !== diagram[key]);
}
```

- **Identity, not deep comparison:** the store creates a new diagram object for every edit, so `!==` means
  "edited". It's instant regardless of diagram size.
- **An empty, never-saved diagram is clean:** there's nothing to lose, so New → New doesn't nag.
- **Navigation isn't an edit:** switching tabs or opening an internal design creates a new object that differs
  only in `activeSectionId`/`activeDetailId`. Comparing every other top-level field *by identity* recognises that
  in O(number of fields). Before this rule, switching tabs showed "Unsaved changes" and triggered an autosave.
- **Undo to the saved state is clean**, because `restore()` puts back the exact saved object.

`isDirty()` reads it outside React (for guards); `useIsDirty()` is the hook (for the toolbar status and the
`beforeunload` warning).

## Toolbar status — `SaveStatus` in `Toolbar.tsx`

| Shown | When |
| --- | --- |
| **Not saved** (red, `role="alert"`) | The last write failed |
| **Saving…** | A write is running |
| **Unsaved changes** (amber) | Dirty, and there is a file handle (autosave will write it shortly) |
| **Not saved to a file** (amber) | Dirty, and no handle: the user must Save |
| **plan.json** (green dot; "Saved" on phones) | Clean and saved to a file |
| nothing | A clean new diagram |

The Save button is highlighted amber while there are changes and no file.

## Opening

- **From a picker — `openDiagramFromDevice()`:** must be called straight from a click, because browsers only show
  file pickers during a user gesture. Cancelling is silent; other failures show "Couldn't open the file".
- **By dropping a file on the start page — `takeDroppedFile(dataTransfer)` then `openDroppedDiagram(dropped)`:**
  split in two because the browser only hands over the file **handle** (so Save can write back in place) *during*
  the drop event. `takeDroppedFile` grabs the file and starts `getAsFileSystemHandle()` synchronously; the start
  page may then ask about unsaved changes before calling `openDroppedDiagram`.
- **Both** go through `openDiagramFile`: `parseDiagramFile` (JSON, then `parseDiagram`), then `startDiagram` with the
  handle and name. Repairs show a **warning** toast listing them ("Save to keep the repaired version"); a file that
  isn't a diagram shows an **error** toast with the reason.

`pickFileWithInput()` accepts `.json,application/json` because some systems report no MIME type for `.json` files.

## Warnings before losing work

| How work could be lost | Protection |
| --- | --- |
| Closing or reloading the tab | `beforeunload` handler while dirty (in `EditorApp`) |
| File → New / Open in the editor | `useUnsavedGuard` in the toolbar |
| Toolbar back button | `useUnsavedGuard`, then `opened: false` |
| Browser Back, then New / Open / a template / dropping a file on `/diagrams` or `/templates` | `useUnsavedGuard` on those pages (the diagram is still in memory) |
| The editor crashing | The editor error page offers a JSON download |

### The unsaved-changes guard

In `src/components/editor/useUnsavedGuard.tsx`.

```ts
const { guard, dialog } = useUnsavedGuard();
guard(() => startDiagram(createBlankDiagram()));             // runs now if nothing would be lost
guard(() => openDiagramFromDevice(), { picker: {...} });    // the action shows a file picker
// …and render {dialog} somewhere on the page.
```

If `isDirty()` is false, the action runs immediately (inside the original click, which matters for pickers).
Otherwise it shows `UnsavedChangesDialog`: **Save** (or **Save as…** when there's no file yet), **Don't save**,
**Cancel**.

**Trap — user activation:** browsers allow a file picker only shortly after a click, and Chrome *consumes* that
permission when it shows a picker. So "Save as… (picker), then Open (another picker)" from one click would fail.
When the action shows a picker (`picker` option) and saving had to show its own picker, the dialog switches to a
second step, **"Saved to "plan.json". Now choose the diagram to open."**, with an **Open…** button; that new click
is what the browser needs. When saving reused an existing handle (no picker), the action runs straight away.

## Leftovers from earlier versions

In `src/lib/diagram/legacy.ts`.

Earlier versions stored diagrams under `bb:diagram:*` and templates under `bb:templates` in `localStorage`.
`readLegacyItems()` finds them (each parsed with `parseDiagram`, unreadable ones skipped), the start page lists
them with **Download** / **Download all** (300 ms apart, because browsers drop rapid downloads), and a confirmed
**Remove from this browser** deletes them plus `bb:index` and `bb:backups`. Nothing is deleted unless the user
chooses it. **Why keep this code:** principle 1 says no copies in the browser, but deleting users' old work without
asking would break principle 3.
