# 5. Diagram store and undo — `src/lib/diagram/store.ts`

`useDiagramStore` is a Zustand store holding:

| State | Meaning |
| --- | --- |
| `diagram` | The open diagram. **Immutable:** every change creates a new object. |
| `selectedNodeIds` | Selected containers/components in the view on screen. |
| `selectedEdgeId` | A selected connection. Never set together with selected nodes. |
| `past`, `future` | Undo and redo stacks of whole earlier diagrams. |

…and every action that changes them. Components read with selectors
(`useDiagramStore((state) => state.diagram.legend)`) and call actions; nothing else mutates a diagram.

## Why immutable, whole-diagram snapshots

- **Undo is trivial and exact:** `past` holds previous diagram objects; undo puts one back. No inverse
  operations to get wrong.
- **Dirty tracking is an identity check:** the file store remembers the exact object it last saved; "unsaved
  changes" is `diagram !== saved` (plus one exception, below). See [files](06-files-saving-and-unsaved-changes.md#dirty-tracking).
- **React re-renders correctly:** unchanged parts keep their identity (structural sharing), so `useMemo` and
  selectors skip work.
- **Memory is fine:** diagrams are small (kilobytes) and history is capped at `HISTORY_LIMIT = 100` steps.

## The active view — `getActiveSection(diagram)`

Despite the historical name, this returns the **view on screen**: either the active tab, or — when
`diagram.activeDetailId` names a component in that tab — that component's internal design (L2), shaped like a
section:

```ts
interface ActiveView extends DiagramSection {
  parent?: { section: DiagramSection; component: DiagramNode }; // set at L2
}
```

For an internal design, `id` is `"<sectionId>/<componentId>"` (unique, used as the canvas key and by exports),
`name` is the component's label, and `nodes`/`edges` come from `component.data.detail`.

**Why one function for both:** every editing action (add, move, connect, align, paste, delete, undo…) operates
on "the active section". Making that mean "the active view" made every existing action work at L2 with no
changes. See [L2](09-connections-and-internal-designs.md#l2--internal-designs).

**Trap — stable references:** Zustand selectors that return a new object on every call make React re-render in a
loop. For L2 views, `getActiveSection` builds a new object, so results are cached in a `WeakMap` keyed by the
component node (and checked against the tab object). The same diagram always yields the same view object; a
test (`returns the same view object while nothing changes`) guards this.

## Writing to the view — `mapActiveSection` / `mapActiveSectionFull`

All edits go through these two helpers:

- `mapActiveSectionFull(diagram, fn)` gives `fn` the active view and writes its result back, to the tab, or into
  `component.data.detail` at L2.
- `mapActiveSection(diagram, fn)` is the same for edits that only touch `nodes`.

At L2 the write-back also:

- **strips any `detail` from nodes landing inside an internal design** (`withoutDetail`). This is where the
  one-level rule is enforced for paste, duplicate and every other path, in one place.
- **removes the `detail` when it becomes empty**, so "has an internal design" simply means `detail` exists.

Both call `touch()`, which sets `updatedAt`.

## Committing changes and undo

```ts
function commit(state, diagram, coalesceKey?) {
  const coalesce = coalesceKey !== undefined && coalesceKey === lastCommit.key && now - lastCommit.at < COALESCE_MS;
  lastCommit = { key: coalesceKey ?? null, at: now };
  return { diagram, past: coalesce ? state.past : [...state.past, state.diagram].slice(-HISTORY_LIMIT), future: [] };
}
```

- Every edit action returns `commit(state, newDiagram, key?)`: the old diagram is pushed onto `past`, and `future`
  is cleared (a new edit after undo discards the redo branch, as in every editor).
- **Coalescing:** edits with the same `coalesceKey` within `COALESCE_MS = 800` ms collapse into **one undo step**.
  The step keeps the diagram from *before* the burst, so a whole drag, a typed word or a colour-picker drag undoes
  at once.

| Burst | Key |
| --- | --- |
| Dragging nodes | `historyKey("move", ids)` = `move:<sorted ids>` |
| Resizing | `historyKey("resize", ids)` |
| Arrow-key nudges | `nudge:<selected ids>` |
| Typing a label | `label:<id>` |
| Typing a detail field | `details:<id>:<field>` |
| Editing a connection field | `edge:<id>:<fields>` |
| Container style (e.g. dragging the outline colour) | `style:<id>:<fields>` |
| Legend entry name/colour | `legend:<key>:<fields>` |
| Diagram name | `rename-diagram` |

**Why the ids are sorted in `historyKey`:** a drag reports position changes in React Flow's order; the
re-parent at the end of the drag (`dropIntoContainers`) lists the dragged nodes in its own order. Sorting gives
both the same key, so a multi-component drag out of a container is one Ctrl+Z, not two.

- **Undo** pops `past` onto the diagram and pushes the current diagram onto `future`; **redo** does the reverse.
  Both go through `restore()`, which:
  - puts back the **exact earlier object** (not a copy). Undoing back to what was saved therefore makes the
    diagram clean again.
  - drops selected ids that no longer exist, and the selected edge if it's gone.
  - resets coalescing, so the next edit starts a fresh step.

**Navigation is not history.** `setActiveSection`, `openDetail` and `closeDetail` change the diagram object
(to record where you are) but don't `commit`, so they aren't undo steps. Undoing an edit made on another tab
returns to that tab, because the restored diagram carries its own `activeSectionId`.

## Every action

| Action | What it does | Undo step |
| --- | --- | --- |
| `loadDiagram(d)` | Makes `d` the open diagram; clears selection and history. Used by `startDiagram`. | Clears history |
| `undo()` / `redo()` | See above. | — |
| `renameDiagram(name)` | Sets the name. | Coalesced |
| `setSelection(ids)` | Selects nodes; clears the edge selection when ids are given. | No |
| `setSelectedEdge(id)` | Selects a connection; clears node selection. | No |
| `addConnection({source, target, sides})` | Joins two **different components** in the view. Refuses containers, self-links and exact duplicates (same ends and sides). Returns the new id, or `null`. Selects it. | Yes |
| `updateConnection(id, patch)` | Edits fields; blank text becomes `undefined`. | Coalesced per field |
| `reverseConnection(id)` | Swaps source/target and their sides. | Yes |
| `deleteConnections(ids)` | Removes connections. No-op (and no step) if none exist. | Yes |
| `selectAll()` | Selects every node in the view. | No |
| `copySelection()` | Copies selected nodes **plus the children of selected containers**, their canvas positions, and the connections between copied nodes. | No |
| `paste()` | Pastes with fresh ids, offset by 24px per repeated paste; re-attaches to the copied container, or the original container if it exists here, else places at the canvas position. Grows containers to fit (`withAdded`). | Yes |
| `duplicateSelection()` | Like copy + paste, but leaves the clipboard alone. | Yes |
| `deleteNodes(ids)` | Deletes nodes and their connections. A deleted container's components are kept, moved out onto the canvas where they were. | Yes |
| `arrangeSelection(op)` | Align/distribute/match size of ≥2 nodes (`arrangeNodes`). | Yes |
| `fitContainer(id)` / `fitAllContainers()` | Shrink or grow container(s) to wrap their components. | Yes |
| `tidyContainer(id)` | Lays a container's components out in a grid. | Yes |
| `setShowTechnology(show)` | Diagram-wide display toggle. | Yes |
| `setActiveSectionNodes(nodes, {coalesceKey})` | Replaces the view's nodes (used by the canvas for drags, resizes, nudges, deletes). Drops connections to removed nodes. | Yes / coalesced |
| `addContainer(position)` | Adds a 320×220 "New Container" and selects it. | Yes |
| `addBlock(position, parentId?, colorKey?)` | Adds a 140×56 "New Block" (first legend colour unless given), inside a container if given, growing it to fit. | Yes |
| `updateNodeLabel(id, label)` | Renames. **No-op if unchanged** (clicking into a label and away doesn't create a step). | Coalesced |
| `updateNodeColor` / `updateNodesColor` | Sets the category. | Yes |
| `updateNodeDetails(id, patch)` | Technology/owner/description/notes; blank becomes `undefined`. | Coalesced per field |
| `updateContainerStyle(id, patch)` | Header position/alignment, outline (`restyleContainer` moves children clear of a moved header). | Coalesced |
| `updateLegendEntry(key, patch)` | Renames/recolours a category. | Coalesced |
| `addLegendEntry()` | Adds "New category" with the first unused palette colour (`nextLegendColor`). Returns its key. | Yes |
| `removeLegendEntry(key)` | Removes it and unassigns it on **every node in every tab and internal design** (`mapEveryNode`). | Yes |
| `setActiveSection(id)` | Switches tab; leaves any internal design; clears selection. | No |
| `openDetail(componentId)` | Opens a component's internal design. Only from a tab (never from inside one: one level deep). | No |
| `closeDetail()` | Back to the tab, with that component selected. | No |
| `addSection(name?)` | Adds "Section N" and opens it. | Yes |
| `renameSection(id, name)` | No-op if unchanged. | Yes |
| `deleteSection(id)` | Not the last one. Opens the neighbour if it was active. | Yes |
| `duplicateSection(id)` | Copies a tab with fresh ids (connections remapped) right after it, and opens it. Internal designs are copied with it. | Yes |

Helpers exported for other modules: `getActiveSection`, `everyNode(diagram)` (every node including inside
internal designs; used for legend usage counts), `componentsWithDetail(section)` (used by exports).

## The clipboard

Module-level (`clipboard`, `clipboardEdges`, `pasteCount`), not in the store. **Why:** copying isn't an edit,
mustn't be undone, and must survive switching tabs so you can copy between tabs (and between a tab and an
internal design). `pasteCount` grows the offset so repeated pastes don't stack exactly on top of each other;
copying resets it.

**Why containers' children are copied too (`withDescendants`):** copying a container without its contents would
be surprising, and copying a child without its container is handled by re-attaching it on paste.

## Adding a new action

See [How to change things](19-how-to.md#add-a-store-action). The short version: compute the new diagram with
`mapActiveSection`/`mapActiveSectionFull` (so it works at L2), return `commit(...)` (with a coalesce key if it
fires repeatedly), and add a test in `tests/lib/diagram/`.
