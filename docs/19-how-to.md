# 19. How to change things

Recipes for common changes, with the files to touch and the rules to keep. After any change: `pnpm test`,
`npx tsc --noEmit`, `pnpm lint`, `pnpm build`, and update the matching page in `docs/`.

## Add a template

1. Create `src/templates/<id>.ts` exporting a `TemplateDefinition` (`id`, `name`, `description`, `build`).
   The easy way is a `CanvasSpec` per tab (columns of containers, components, connections by name; a component's
   `detail` is its internal design) and `build: () => buildDiagram(name, tabs)` from `./build`, which mints fresh
   ids and copies the legend. A hand-written `build()` must do both too: a **new** diagram with **fresh ids** every
   call (use `createId`), and `DEFAULT_LEGEND.map((entry) => ({ ...entry }))` so diagrams don't share the legend.
2. Add it to the list in `src/templates/index.ts`.
3. `tests/templates/templates.test.ts` runs every listed template through the validator and the layout checks.

It appears on `/templates` and the start page automatically, with a preview drawn from `build()`.

## Add a store action

1. Add its signature to `DiagramState` in `src/lib/diagram/store.ts`, with a doc comment if it isn't obvious.
2. Implement it with `set((state) => ...)`:
   - compute the new diagram with `mapActiveSection` / `mapActiveSectionFull` (so it works in internal designs too);
   - return `commit(state, newDiagram)` for an edit, adding a coalesce key if it fires repeatedly (typing,
     dragging);
   - return `state` unchanged when nothing changes (so no empty undo step is recorded);
   - navigation (not an edit) sets `diagram` without `commit`.
3. Keep the [invariants](04-data-model-and-file-format.md#invariants), e.g. call `withoutDanglingEdges` if nodes can
   disappear, `growContainerToFit` if components can move past a container's edge.
4. Test it in `tests/lib/diagram/`.

## Add a field to the data model

1. Add it to `src/lib/diagram/types.ts` as **optional**, so older files stay valid, with a doc comment saying its
   default.
2. Read it in `src/lib/diagram/validate.ts` explicitly (type-check it; never spread raw input).
3. If it's navigation state rather than content, add it to the ignored keys in `differsFromSaved` (`file.ts`).
4. Show it in the UI, include it in exports if relevant (CSV columns in `export.ts`), and document it in
   [the data model](04-data-model-and-file-format.md).
5. A change old versions can't read needs `schemaVersion: 2` and a migration in `parseDiagram`.

## Add an export format

1. Add it to `ExportFormat` and `IMAGE_FORMATS` or `DATA_FORMATS` in `src/lib/diagram/exportPlan.ts`, plus its
   extension and file naming in `planExport`, and its wording in `describeFiles`.
2. Add a label and hint to `FORMAT_INFO` in `ExportDialog.tsx`.
3. Produce its Blob in `runExport` (`Toolbar.tsx`). Put the actual conversion in `src/lib/diagram/export.ts` as a
   function returning a Blob.
4. Add cases to `tests/lib/diagram/exportPlan.test.ts`.

## Add a keyboard shortcut

Add it to `handleKeyDown` in `EditorApp.tsx` (or to the component that owns it), list it in `ShortcutsHelp.tsx`
and in [the editor docs](07-editor-ui.md#keyboard-shortcuts). Don't take keys browsers or screen readers rely on.

## Add a toast

Use `toast.success|info|warning|error` and follow the [writing rules](12-notifications.md#writing-rules): short
title, "Couldn't…" for failures, one-sentence description with the next step.

## Add a page

1. Create `src/app/<name>/page.tsx`; export `metadata`.
2. If it is part of the app (needs consent), add the path to `GATED` in `src/components/ConsentGate.tsx`.
3. If it must stay reachable during maintenance, it can't: every page is rewritten. Make it a static file instead.
4. Link it from the footer if public; document it in [routing](03-routing.md).

## Store something new in the browser

1. Use a `bb:`-prefixed key; wrap every access in `try/catch`; work without it.
2. Never store diagram content.
3. Add it to the [storage table](11-privacy-consent-and-forms.md#everything-stored-in-the-browser) and to the privacy
   notice, then bump `PRIVACY_VERSION`.

## Change the privacy notice

See [operations](16-operations.md#changing-the-privacy-notice).

## Ship a new architecture level

Add its store actions, then list them in `requires` for that level in `src/lib/levels.ts`. The landing page updates
itself; update `tests/lib/levels.test.ts`.

## Change the default legend or palette

- `src/lib/diagram/defaultLegend.ts` affects new diagrams only (existing files keep their own legend).
- `src/lib/diagram/palette.ts`: keep every default legend colour in the palette (a test checks this) and keep colours
  `#rrggbb`, lower-case, unique.

## Turn on the forms

Set `NEXT_PUBLIC_WAITLIST_URL` (the waitlist form) and `NEXT_PUBLIC_CONTACT_EMAIL` (the address on `/contact`) at the host and rebuild
([operations](16-operations.md#environment-variables)).
