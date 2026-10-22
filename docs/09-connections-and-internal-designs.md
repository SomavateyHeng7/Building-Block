# 9. Connections (L1) and internal designs (L2)

Building Block follows architecture *levels*. Each level adds detail and stays linked to the one above.

| Level | What it shows | Stored in | Status source |
| --- | --- | --- | --- |
| **L0** — landscape | Containers and components, coloured by the legend | `section.nodes` | needs store actions `addContainer`, `addBlock`, `addLegendEntry` |
| **L1** — interactions | Connections between components | `section.edges` | needs `addConnection`, `updateConnection`, `deleteConnections` |
| **L2** — internal design | What one component is made of | `component.data.detail` | needs `openDetail`, `closeDetail` |

The landing page's roadmap is computed from this table (`src/lib/levels.ts`): a level shows **"Available now"**
when every store action it needs exists, otherwise the first missing level is **"Coming next"** and the rest
**"Planned"**. **Why:** the roadmap can't drift out of date; shipping the feature flips it. `tests/lib/levels.test.ts`
is the reminder to update the expectations when a level ships.

## L1 — connections

A connection (`DiagramEdge`) joins two **components** in the same canvas. Containers can't be connected: in L1,
interactions are between systems, and a container is a grouping.

**Creating one:**

- Drag from one of a component's four dots (handles) to another component. `ConnectionMode.Loose` means any dot can
  start or end a connection; the sides are stored (`sourceSide`, `targetSide`) so the line keeps its route.
- Or select a component and use **Connect to…** in the details panel, which picks facing sides
  (`suggestConnectionSides`).

`addConnection` refuses self-connections, containers, and an *exact* duplicate (same ends **and** sides). Two
connections between the same components on different sides are allowed (e.g. a request and a separate event
stream).

**Editing:** select the line (24 px hit area) to edit *What flows*, *Protocol or technology*, *Description*, arrows
(one way, both ways, none), and line style (dashed for asynchronous calls). Reverse swaps the ends. The canvas
caption is "What flows · Protocol" (`connectionCaption`).

**Routing:** *Route* picks right angles (`step`, the default), curved or straight. A selected line shows a blue dot
just above its label (`edges/ConnectionEdge.tsx`): dragging it stores `bend`, the offset of the line's middle from
its default position, snapped to 8 px, coalesced into one undo step per drag. Double-clicking the dot, or **Reset
line**, removes it. The geometry is `connectionPath` in `flowAdapter.ts` (tested): a right-angled line moves its
middle segment to the point, and curved and straight lines pass through it. **Attach to nearest sides** sets the
facing sides (`suggestConnectionSides`) and clears the bend.

- **Why an offset, not a fixed waypoint:** a waypoint in canvas coordinates is left behind when a component moves;
  an offset from the default middle moves with the line.
- **Why not automatic obstacle avoidance:** it moves lines the architect didn't touch whenever anything moves, and
  needs a routing library. One draggable middle covers the usual "this line crosses a box" case.
- The dot is only drawn on a selected line, and exports clear the selection, so it never appears in pictures.

**Deleting a component deletes its connections** (`withoutDanglingEdges`), in the same undo step.

**Copying:** connections are copied when *both* ends are copied (copy/paste, duplicate, duplicate tab).

**Export:** drawn in images; listed in the connection CSV (Section, Part of, From, To, Direction, Line, What
flows, Protocol, Description).

## L2 — internal designs

Any component on a tab can have an **internal design**: its own canvas with containers, components and
connections, using the same tools as a tab.

### Using it

- **Open:** select a component and click **Design its internals** (or **Open internal design** once it has
  content) in the details panel, or click the blue **L2** badge on the component.
- A blue bar above the canvas shows **← Back to *tab* / *component* · L2 · Internal design**.
- With nothing selected, the details panel shows **Internal design**: the component you're inside, its technology
  and description, and **its connections at L1**. This is the "linked to the level above".
- **Back:** the bar's button, **Esc** with nothing selected, or clicking the tab. You return with the component
  selected.

### How it is stored, and why

```jsonc
// a component on a tab
{ "id": "block_orders", "type": "block", "data": {
    "kind": "block", "label": "Orders",
    "detail": { "nodes": [ /* its own containers and components */ ], "edges": [ /* … */ ] } } }
```

- **Inside the component, in the same file.** It travels with the component: copy, duplicate, duplicate tab and
  delete/undo all work without extra code, and there is still one file per diagram (principle 1). The
  alternative, linking out to separate diagram files, would break as soon as a file was renamed or moved, and
  browsers can't open a linked file without the user picking it.
- **One level deep.** Components inside an internal design can't have their own. The store strips any `detail`
  from nodes that land in an internal design (paste, duplicate…), `openDetail` refuses to open one from inside
  one, and the file parser removes nested ones with a repair note. **Why:** L2 is "what a component is made of";
  going deeper is rarely useful in solution documents, and one level keeps navigation (and the code) simple.
  The data shape could support more later.
- **Absent until used, removed when emptied.** Opening an internal design doesn't create anything; the first
  thing drawn creates `detail`, and deleting the last thing removes it. So "has an internal design" is simply
  "`detail` exists", and empty designs never clutter files or exports.
- **Which one is open is saved** (`diagram.activeDetailId`) but, like the active tab, is **navigation, not an
  edit**: opening and closing are not undo steps and don't mark the diagram unsaved.

### How the editor works on it

The store's `getActiveSection(diagram)` returns the internal design, shaped like a section, when one is open, and
`mapActiveSectionFull` writes changes back into `component.data.detail`. So every existing action works at L2
without changes. Details in [the store](05-diagram-store-and-undo.md#the-active-view--getactivesectiondiagram).

The canvas remounts (its React Flow `key` is the view id `"<tab>/<component>"`), so each internal design has its own
zoom and position.

### Everywhere else L2 shows up

| Feature | Behaviour |
| --- | --- |
| Legend usage counts | Include components inside internal designs (`everyNode`). |
| Removing a legend entry | Unassigns it inside internal designs too. |
| Exports | Each internal design can be pictured; its title is "Diagram — Tab — Component (internal design)"; the CSVs have a **Part of** column naming the component. See [Export](10-export.md). |
| File validation | Internal designs are validated with the same rules as tabs. |
| Undo | Edits inside an internal design are normal undo steps. Undoing far enough back can return you to the tab, because earlier diagrams record where you were. |

Tests: `tests/lib/diagram/detail.test.ts`.
