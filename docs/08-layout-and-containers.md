# 8. Layout and containers — `src/lib/diagram/layout.ts`

Pure functions that take a node list and return a new one. The store and the canvas call them; the tests in
`tests/lib/diagram/layout.test.ts` cover them.

## Nesting rules

- Only **components** sit inside containers, and only **one level** deep (no containers in containers).
- A nested component's `position` is **relative to its container**; `absolutePosition(node, nodes)` adds the
  container's position to get canvas coordinates.
- Inside a container, components stay clear of the **header** and **padding**. `containerInsets(style)` gives
  the space on each side: `CONTAINER_HEADER = 40` on the header's side, `CONTAINER_PADDING = 16` on the others.
  Moving the header to another side changes which side is 40.
- Containers grow to fit their components; they **never clip** them. The resize handles have minimum sizes worked
  out from the components inside (`ContainerNode`), and every operation that could push a component past an edge
  calls `growContainerToFit` afterwards.

**Why one level only:** L0 diagrams group systems into domains or layers; deeper nesting is what L2 (internal
designs) is for. It also keeps every algorithm here simple: a node's canvas position is at most one addition away.

## Constants

| Constant | Value | Used for |
| --- | --- | --- |
| `CONTAINER_PADDING` | 16 | Space between a container's edge and its components |
| `CONTAINER_HEADER` | 40 | Space on the header's side |
| `LAYOUT_GAP` | 12 | Gap between components in Tidy and below the lowest one for new components |
| `CONTAINER_MIN` | 200 × 120 | Smallest size Fit/Tidy/restyle will produce |

## Functions

### `growContainerToFit(nodes, containerId)`

Grows (never shrinks) a container so its components fit, with padding on the right and bottom. Returns the same
node objects when nothing needs to grow, which lets callers detect "no change" by identity.

### `fitContainerToContents(nodes, containerId)`

Shrinks or grows a container to wrap its components with standard insets. It shifts the components so the
top-left one sits exactly at the insets, and **moves the container by the opposite amount**, so nothing moves on
screen; only the container's edges do. Never smaller than `CONTAINER_MIN`.

### `tidyContainer(nodes, containerId)`

Lays components out in a grid in **reading order** (sorted by y, then x, so the result resembles what the user
drew). Cells are the size of the largest component; the number of columns is what fits in the container's
*current* width; then the container's height is fitted to the rows. **Why keep the width:** the user chose it, and
it decides the grid's shape.

### `arrangeNodes(nodes, ids, op)`

Align (left, centre, right, top, middle, bottom), distribute (horizontal, vertical: equal *gaps*, not equal
centres, which is what people mean by "evenly spaced" for boxes of different sizes), or match width/height (to the
widest/tallest). It works in **canvas coordinates** so nodes in different containers line up on screen. Positions
are rounded to whole pixels.

Two rules keep containers consistent:

1. **A selected container carries its children.** If a container and its own components are both selected, the
   components aren't arranged separately; they move with the container. *(Without this, a component moved
   twice: once by the alignment, and again with its container, ending up outside it.)*
2. **The result is settled with `dropIntoContainers`**, exactly as if each moved component had been dragged there:
   aligning a component out of its container takes it out; aligning it within keeps it inside, clear of the header,
   with the container grown to fit.

### `nudgeNodes(nodes, ids, dx, dy)`

Arrow-key moves. A container carries its children (a child only moves if its container isn't also moving). Nested
components can't be nudged into the header or padding on the top/left; their container grows on the bottom/right.
**Why nudging can't take a component out of its container:** arrow keys make small precise moves; leaving a
container is a deliberate drag.

### `nextSlotInContainer(nodes, containerId)`

Where a new component goes when added into a container (B key, tapping the palette with a container selected):
below the lowest component, or at the insets when empty.

### `restyleContainer(nodes, containerId, patch)`

Applies a style change. When the header moves to another side, the components shift by the difference in insets
and the container resizes, so nothing ends up under the header.

### `suggestConnectionSides(nodes, sourceId, targetId)`

For the "Connect to…" picker: the sides that face each other. Horizontal (right→left or left→right) when the
components are further apart across than down, otherwise vertical.

### `groupIntoContainer(nodes, ids, container)`

Group (Ctrl/⌘+G). Wraps the components among `ids` in a new container drawn around them with standard insets,
so **nothing moves on screen**; they leave any container they were in. Containers among `ids` are ignored (no
nesting). Never smaller than `CONTAINER_MIN`. The container is added last, so where it overlaps another it is the
top-most one (what `dropIntoContainers` picks). Returns the same array when there is nothing to group.

Ungroup (Ctrl/⌘+Shift+G, `ungroupNodes` in the store) is deleting the container while keeping its components:
they stay where they are on screen, out of any container. Connections to the container itself go with it.

### Drag-and-drop re-parenting — `dropIntoContainers`

Called when a drag ends (and by `arrangeNodes`). For each moved **component** whose container isn't also moving:

1. Work out its canvas position from its new position and its *old* container.
2. Find the **top-most container under the component's centre** (later containers render on top, so `findLast`).
3. Inside one: position it relative to that container, kept clear of the header/padding (top/left), and mark the
   container to grow (bottom/right). Outside all: canvas coordinates, no parent.
4. Update `parentId` and `data.containerId`, and grow every affected container.

Unchanged nodes keep their identity, so the canvas can skip the store update entirely when nothing changed.

**Why the centre, not any overlap:** with "any overlap", a component dragged slightly past its container's edge
would still overlap and could never leave; one barely touching a neighbour would jump into it. The centre matches
what people see as "inside".

**Why this replaced React Flow's `extent: "parent"`:** that option clamps a child inside its parent during the
drag, which made it impossible to drag a component out of a container at all, and cut/paste put it back into the
same one. See the [decision log](17-decision-log.md#components-can-leave-containers).
