import type { ConnectionSide, ContainerStyle, DiagramNode, Position, Size } from "../types";

/** Inner spacing of a container; the side with the header leaves room for it. */
export const CONTAINER_PADDING = 16;
export const CONTAINER_HEADER = 40;
export const LAYOUT_GAP = 12;
export const CONTAINER_MIN: Size = { width: 200, height: 120 };
/** The smallest each kind of box can be resized to (a container also fits around what's in it). */
export const MIN_NODE_SIZE: Record<DiagramNode["type"], Size> = {
  container: CONTAINER_MIN,
  block: { width: 80, height: 32 },
  text: { width: 24, height: 16 },
};

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Where a container's children may start and end, depending on which side its header is on. */
export function containerInsets(style?: ContainerStyle): Insets {
  const side = style?.headerPosition ?? "top";
  const inset = (edge: keyof Insets) => (edge === side ? CONTAINER_HEADER : CONTAINER_PADDING);
  return { top: inset("top"), right: inset("right"), bottom: inset("bottom"), left: inset("left") };
}

function insetsOf(nodes: DiagramNode[], containerId: string): Insets {
  const container = nodes.find((node) => node.id === containerId);
  return containerInsets(container?.data.kind === "container" ? container.data : undefined);
}

export type ArrangeOp =
  | "align-left"
  | "align-center"
  | "align-right"
  | "align-top"
  | "align-middle"
  | "align-bottom"
  | "distribute-horizontal"
  | "distribute-vertical"
  | "same-width"
  | "same-height";

const extentsCache = new WeakMap<DiagramNode[], Map<string, { right: number; bottom: number }>>();

/**
 * How far each container's components reach (right and bottom edges, relative to the container), by container id.
 * Worked out once per nodes array: every container asks on every edit, so scanning the nodes per container made
 * each drag frame cost containers × nodes.
 */
export function contentExtents(nodes: DiagramNode[]): ReadonlyMap<string, { right: number; bottom: number }> {
  let extents = extentsCache.get(nodes);
  if (extents) return extents;
  extents = new Map();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const current = extents.get(node.parentId) ?? { right: 0, bottom: 0 };
    current.right = Math.max(current.right, node.position.x + node.size.width);
    current.bottom = Math.max(current.bottom, node.position.y + node.size.height);
    extents.set(node.parentId, current);
  }
  extentsCache.set(nodes, extents);
  return extents;
}

/** Canvas position: a nested node's position plus that of every container it's in. */
export function absolutePosition(node: DiagramNode, nodes: DiagramNode[]): Position {
  if (!node.parentId) return node.position;
  let { x, y } = node.position;
  for (const id of ancestorIds(node, nodes)) {
    const parent = nodes.find((candidate) => candidate.id === id)!;
    x += parent.position.x;
    y += parent.position.y;
  }
  return { x, y };
}

/** The ids of the containers a node is in, innermost first. Stops at a missing parent or a loop. */
export function ancestorIds(node: DiagramNode, nodes: readonly DiagramNode[]): string[] {
  const found: string[] = [];
  let parentId = node.parentId;
  while (parentId && parentId !== node.id && !found.includes(parentId)) {
    const parent = nodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    found.push(parentId);
    parentId = parent.parentId;
  }
  return found;
}

/**
 * The innermost container under a canvas point (among equally deep ones, the one drawn on top: listed later), with
 * where it is on the canvas.
 */
export function containerAt(
  nodes: DiagramNode[],
  point: Position,
): { node: DiagramNode; abs: Position } | undefined {
  let found: { node: DiagramNode; abs: Position; depth: number } | undefined;
  for (const node of nodes) {
    if (node.type !== "container") continue;
    const abs = absolutePosition(node, nodes);
    const inside =
      point.x >= abs.x && point.x <= abs.x + node.size.width && point.y >= abs.y && point.y <= abs.y + node.size.height;
    if (!inside) continue;
    const depth = nestingDepth(node, nodes);
    if (!found || depth >= found.depth) found = { node, abs, depth };
  }
  return found && { node: found.node, abs: found.abs };
}

/** How many containers a node is in: 0 on the canvas, 1 in a top-level container, and so on. */
export function nestingDepth(node: DiagramNode, nodes: readonly DiagramNode[]): number {
  return ancestorIds(node, nodes).length;
}

/** Whether any container the node is in is among `ids` (it moves, or is deleted, with that one). */
export function hasAncestorIn(node: DiagramNode, nodes: readonly DiagramNode[], ids: ReadonlySet<string> | readonly string[]): boolean {
  const has = (id: string) => ("has" in ids ? ids.has(id) : ids.includes(id));
  return ancestorIds(node, nodes).some(has);
}

/**
 * Which sides a connection from one component to another should use: the sides facing each other,
 * horizontally when they are further apart across than down.
 */
export function suggestConnectionSides(
  nodes: DiagramNode[],
  sourceId: string,
  targetId: string,
): { sourceSide: ConnectionSide; targetSide: ConnectionSide } {
  const source = nodes.find((node) => node.id === sourceId);
  const target = nodes.find((node) => node.id === targetId);
  if (!source || !target) return { sourceSide: "right", targetSide: "left" };
  return facingSides({ ...absolutePosition(source, nodes), ...source.size }, { ...absolutePosition(target, nodes), ...target.size });
}

/** The sides of two boxes (in canvas coordinates) that face each other: across when further apart across than down. */
export function facingSides(
  from: Position & Size,
  to: Position & Size,
): { sourceSide: ConnectionSide; targetSide: ConnectionSide } {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { sourceSide: "right", targetSide: "left" } : { sourceSide: "left", targetSide: "right" };
  }
  return dy >= 0 ? { sourceSide: "bottom", targetSide: "top" } : { sourceSide: "top", targetSide: "bottom" };
}

/**
 * Aligns, distributes or matches the size of the given nodes, working in canvas coordinates.
 * A selected container carries its children, so they aren't arranged separately. A component that
 * ends up over a different container (or none) moves into it, as if it had been dragged there.
 */
export function arrangeNodes(nodes: DiagramNode[], ids: string[], op: ArrangeOp): DiagramNode[] {
  const targets = nodes
    .filter((node) => ids.includes(node.id) && !hasAncestorIn(node, nodes, ids))
    .map((node) => ({ node, abs: absolutePosition(node, nodes) }));
  if (targets.length < 2) return nodes;

  const left = Math.min(...targets.map((t) => t.abs.x));
  const top = Math.min(...targets.map((t) => t.abs.y));
  const right = Math.max(...targets.map((t) => t.abs.x + t.node.size.width));
  const bottom = Math.max(...targets.map((t) => t.abs.y + t.node.size.height));
  const widest = Math.max(...targets.map((t) => t.node.size.width));
  const tallest = Math.max(...targets.map((t) => t.node.size.height));

  const next = new Map<string, { abs: Position; size: Size }>();
  const place = (id: string, abs: Position, size: Size) => next.set(id, { abs, size });

  if (op === "distribute-horizontal" || op === "distribute-vertical") {
    const horizontal = op === "distribute-horizontal";
    const sorted = [...targets].sort((a, b) => (horizontal ? a.abs.x - b.abs.x : a.abs.y - b.abs.y));
    const span = horizontal ? right - left : bottom - top;
    const occupied = sorted.reduce(
      (sum, t) => sum + (horizontal ? t.node.size.width : t.node.size.height),
      0,
    );
    const gap = (span - occupied) / (sorted.length - 1);
    let cursor = horizontal ? left : top;
    for (const t of sorted) {
      place(t.node.id, horizontal ? { x: cursor, y: t.abs.y } : { x: t.abs.x, y: cursor }, t.node.size);
      cursor += (horizontal ? t.node.size.width : t.node.size.height) + gap;
    }
  } else {
    for (const { node, abs } of targets) {
      const { width, height } = node.size;
      switch (op) {
        case "align-left":
          place(node.id, { x: left, y: abs.y }, node.size);
          break;
        case "align-center":
          place(node.id, { x: (left + right) / 2 - width / 2, y: abs.y }, node.size);
          break;
        case "align-right":
          place(node.id, { x: right - width, y: abs.y }, node.size);
          break;
        case "align-top":
          place(node.id, { x: abs.x, y: top }, node.size);
          break;
        case "align-middle":
          place(node.id, { x: abs.x, y: (top + bottom) / 2 - height / 2 }, node.size);
          break;
        case "align-bottom":
          place(node.id, { x: abs.x, y: bottom - height }, node.size);
          break;
        case "same-width":
          place(node.id, abs, { width: widest, height });
          break;
        case "same-height":
          place(node.id, abs, { width, height: tallest });
          break;
      }
    }
  }

  const arranged = nodes.map((node) => {
    const placed = next.get(node.id);
    if (!placed) return node;
    const parent = node.parentId ? nodes.find((candidate) => candidate.id === node.parentId) : undefined;
    const offset = parent ? absolutePosition(parent, nodes) : { x: 0, y: 0 };
    const position = { x: placed.abs.x - offset.x, y: placed.abs.y - offset.y };
    return { ...node, position: snap(position), size: placed.size };
  });
  return dropIntoContainers(
    arranged,
    arranged.filter((node) => next.has(node.id)).map((node) => ({ id: node.id, position: node.position })),
  );
}

function childrenOf(nodes: DiagramNode[], containerId: string) {
  return nodes.filter((node) => node.parentId === containerId);
}

function snap(position: Position): Position {
  return { x: Math.round(position.x), y: Math.round(position.y) };
}

/**
 * Grows (never shrinks) a container so all of its children fit inside. A container that grows may then stick
 * out of the container it's in, so that one is grown too, and so on up.
 */
export function growContainerToFit(nodes: DiagramNode[], containerId: string): DiagramNode[] {
  let next = nodes;
  const seen = new Set<string>();
  for (let id: string | undefined = containerId; id && !seen.has(id); ) {
    seen.add(id);
    const grown = growOne(next, id);
    if (grown === next) break;
    next = grown;
    id = next.find((node) => node.id === id)?.parentId;
  }
  return next;
}

function growOne(nodes: DiagramNode[], containerId: string): DiagramNode[] {
  const children = childrenOf(nodes, containerId);
  if (!children.length) return nodes;
  const insets = insetsOf(nodes, containerId);
  const needWidth = Math.max(...children.map((c) => c.position.x + c.size.width)) + insets.right;
  const needHeight = Math.max(...children.map((c) => c.position.y + c.size.height)) + insets.bottom;
  const container = nodes.find((node) => node.id === containerId);
  if (!container || (needWidth <= container.size.width && needHeight <= container.size.height)) return nodes;
  return nodes.map((node) =>
    node.id === containerId
      ? {
          ...node,
          size: {
            width: Math.max(node.size.width, needWidth),
            height: Math.max(node.size.height, needHeight),
          },
        }
      : node,
  );
}

/** Shrinks or grows a container to wrap its children with standard padding. */
export function fitContainerToContents(nodes: DiagramNode[], containerId: string): DiagramNode[] {
  const children = childrenOf(nodes, containerId);
  if (!children.length) return nodes;
  const insets = insetsOf(nodes, containerId);
  const minX = Math.min(...children.map((c) => c.position.x));
  const minY = Math.min(...children.map((c) => c.position.y));
  const dx = insets.left - minX;
  const dy = insets.top - minY;
  const maxX = Math.max(...children.map((c) => c.position.x + c.size.width)) + dx;
  const maxY = Math.max(...children.map((c) => c.position.y + c.size.height)) + dy;
  const parentId = nodes.find((node) => node.id === containerId)?.parentId;

  const fitted = nodes.map((node) => {
    if (node.parentId === containerId) {
      return { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } };
    }
    if (node.id === containerId) {
      return {
        ...node,
        // Keep children where they are on screen by moving the container by the same offset.
        position: { x: node.position.x - dx, y: node.position.y - dy },
        size: {
          width: Math.max(CONTAINER_MIN.width, maxX + insets.right),
          height: Math.max(CONTAINER_MIN.height, maxY + insets.bottom),
        },
      };
    }
    return node;
  });
  // Growing can push a nested container past the edge of the one it's in.
  return parentId ? growContainerToFit(fitted, parentId) : fitted;
}

/**
 * Lays a container's children out in a grid (reading order is kept) using the
 * container's current width, then fits the container's height to the grid.
 */
export function tidyContainer(nodes: DiagramNode[], containerId: string): DiagramNode[] {
  const container = nodes.find((node) => node.id === containerId);
  // Components and nested containers are laid out in the grid: a text box (a caption, a note) stays where it was put.
  const children = childrenOf(nodes, containerId).filter((node) => node.type !== "text").sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
  );
  if (!container || !children.length) return nodes;
  const insets = insetsOf(nodes, containerId);

  const cellWidth = Math.max(...children.map((c) => c.size.width));
  const cellHeight = Math.max(...children.map((c) => c.size.height));
  const usableWidth = container.size.width - insets.left - insets.right;
  const columns = Math.max(1, Math.floor((usableWidth + LAYOUT_GAP) / (cellWidth + LAYOUT_GAP)));
  const rows = Math.ceil(children.length / columns);

  const positions = new Map(
    children.map((child, index) => [
      child.id,
      {
        x: insets.left + (index % columns) * (cellWidth + LAYOUT_GAP),
        y: insets.top + Math.floor(index / columns) * (cellHeight + LAYOUT_GAP),
      },
    ]),
  );

  const tidied = nodes.map((node) => {
    const position = positions.get(node.id);
    if (position) return { ...node, position };
    if (node.id === containerId) {
      return {
        ...node,
        size: {
          width: Math.max(node.size.width, insets.left + cellWidth + insets.right),
          height: Math.max(
            CONTAINER_MIN.height,
            insets.top + rows * (cellHeight + LAYOUT_GAP) - LAYOUT_GAP + insets.bottom,
          ),
        },
      };
    }
    return node;
  });
  return container.parentId ? growContainerToFit(tidied, container.parentId) : tidied;
}

/**
 * Re-arranges, in a grid, every container whose components overlap one another, and reports how many it did.
 * Imports can pile shapes on top of each other (a draw.io layer, a coarse grid); containers whose components
 * already sit clear of each other keep their layout.
 */
export function tidyOverlappingContainers(nodes: DiagramNode[]): { nodes: DiagramNode[]; tidied: number } {
  const overlaps = (a: DiagramNode, b: DiagramNode) =>
    a.position.x < b.position.x + b.size.width &&
    b.position.x < a.position.x + a.size.width &&
    a.position.y < b.position.y + b.size.height &&
    b.position.y < a.position.y + a.size.height;
  let result = nodes;
  let tidied = 0;
  for (const container of nodes.filter((node) => node.type === "container")) {
    const children = childrenOf(nodes, container.id);
    if (!children.some((child, index) => children.slice(index + 1).some((other) => overlaps(child, other)))) continue;
    result = tidyContainer(result, container.id);
    tidied += 1;
  }
  return { nodes: result, tidied };
}

/**
 * Settles boxes after a drag. `moved` gives each dragged node's new position (relative to its current container,
 * if any). Each one belongs to the innermost container its centre is over, or to none: so it can be dragged into
 * a container, out of one, or into another. Containers nest the same way. Inside, a box is kept clear of the
 * header and padding, and the container grows to fit it. Boxes moving with a container they're in are left
 * alone, and nothing goes into a box that is moving too (which also keeps a container out of its own contents).
 */
export function dropIntoContainers(nodes: DiagramNode[], moved: { id: string; position: Position }[]): DiagramNode[] {
  const movedIds = new Set(moved.map((entry) => entry.id));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Where each container is on the canvas and how deep it is, before anything moves to another one.
  const containers = nodes
    .filter((node) => node.type === "container" && !movedIds.has(node.id) && !hasAncestorIn(node, nodes, movedIds))
    .map((node, order) => ({ node, abs: absolutePosition(node, nodes), depth: nestingDepth(node, nodes), order }));
  const grow = new Set<string>();
  let next = nodes;
  for (const { id, position } of moved) {
    const node = byId.get(id);
    if (!node || hasAncestorIn(node, nodes, movedIds)) continue;
    const oldParent = node.parentId ? byId.get(node.parentId) : undefined;
    const offset = oldParent ? absolutePosition(oldParent, nodes) : { x: 0, y: 0 };
    const absolute = { x: position.x + offset.x, y: position.y + offset.y };
    const centre = { x: absolute.x + node.size.width / 2, y: absolute.y + node.size.height / 2 };
    // The innermost container under the centre; among equally deep ones, the one drawn on top (listed later).
    let parent: (typeof containers)[number] | undefined;
    for (const candidate of containers) {
      const inside =
        centre.x >= candidate.abs.x &&
        centre.x <= candidate.abs.x + candidate.node.size.width &&
        centre.y >= candidate.abs.y &&
        centre.y <= candidate.abs.y + candidate.node.size.height;
      if (inside && (!parent || candidate.depth >= parent.depth)) parent = candidate;
    }
    let settled = absolute;
    if (parent) {
      const insets = insetsOf(nodes, parent.node.id);
      settled = {
        x: Math.max(insets.left, absolute.x - parent.abs.x),
        y: Math.max(insets.top, absolute.y - parent.abs.y),
      };
      grow.add(parent.node.id);
    }
    const parentId = parent?.node.id;
    if (parentId === node.parentId && settled.x === node.position.x && settled.y === node.position.y) continue;
    // A container that stays where it is in the nesting keeps the position the drag gave it.
    if (node.type === "container" && parentId === node.parentId && settled.x === position.x && settled.y === position.y) continue;
    next = next.map((candidate) => {
      if (candidate.id !== id) return candidate;
      const rest = { ...candidate };
      delete rest.parentId;
      return {
        ...rest,
        position: settled,
        ...(parentId ? { parentId } : {}),
        data: candidate.data.kind === "block" ? { ...candidate.data, containerId: parentId ?? null } : candidate.data,
      };
    });
  }
  for (const containerId of grow) next = growContainerToFit(next, containerId);
  return next;
}

/**
 * Orders nodes so every container comes before what's inside it, keeping the order otherwise (React Flow needs
 * parents first). Returns the same array when it is already in order.
 */
export function parentsFirst(nodes: DiagramNode[]): DiagramNode[] {
  const index = new Map(nodes.map((node, at) => [node.id, at]));
  if (nodes.every((node, at) => !node.parentId || (index.get(node.parentId) ?? -1) < at)) return nodes;
  const placed = new Set<string>();
  const ordered: DiagramNode[] = [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const place = (node: DiagramNode, path: Set<string>) => {
    if (placed.has(node.id)) return;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && !path.has(parent.id)) place(parent, new Set(path).add(node.id));
    placed.add(node.id);
    ordered.push(node);
  };
  for (const node of nodes) place(node, new Set([node.id]));
  return ordered;
}

/**
 * Wraps boxes in a new container drawn around them, so nothing moves on screen. Components, text boxes and
 * containers can be grouped; a box selected along with a container it's in moves with that container. The new
 * container goes where the grouped boxes were when they all shared a container, otherwise on the canvas.
 * Returns the same nodes when there is no component or container to group. The container is added last, so
 * it is the top-most one where it overlaps another.
 */
export function groupIntoContainer(
  nodes: DiagramNode[],
  ids: string[],
  container: { id: string; label: string },
): DiagramNode[] {
  const members = nodes
    .filter((node) => node.type !== "text" && ids.includes(node.id) && !hasAncestorIn(node, nodes, ids))
    .map((node) => ({ node, abs: absolutePosition(node, nodes) }));
  if (!members.length) return nodes;
  const shared = members[0].node.parentId;
  const outer = shared && members.every((m) => m.node.parentId === shared) ? nodes.find((node) => node.id === shared) : undefined;
  const outerAbs = outer ? absolutePosition(outer, nodes) : { x: 0, y: 0 };
  const insets = containerInsets();
  const absolute = snap({
    x: Math.min(...members.map((m) => m.abs.x)) - insets.left,
    y: Math.min(...members.map((m) => m.abs.y)) - insets.top,
  });
  const right = Math.max(...members.map((m) => m.abs.x + m.node.size.width));
  const bottom = Math.max(...members.map((m) => m.abs.y + m.node.size.height));
  const placed = new Map(members.map(({ node, abs }) => [node.id, { x: abs.x - absolute.x, y: abs.y - absolute.y }]));

  const wrapped = nodes.map((node) => {
    const at = placed.get(node.id);
    if (!at) return node;
    return {
      ...node,
      position: at,
      parentId: container.id,
      data: node.data.kind === "block" ? { ...node.data, containerId: container.id } : node.data,
    };
  });
  const position = outer ? { x: absolute.x - outerAbs.x, y: absolute.y - outerAbs.y } : absolute;
  const grouped: DiagramNode[] = [
    ...wrapped,
    {
      id: container.id,
      type: "container",
      position,
      size: {
        width: Math.max(CONTAINER_MIN.width, Math.ceil(right - absolute.x + insets.right)),
        height: Math.max(CONTAINER_MIN.height, Math.ceil(bottom - absolute.y + insets.bottom)),
      },
      ...(outer ? { parentId: outer.id } : {}),
      data: { kind: "container", label: container.label },
    },
  ];
  // It may not fit in the container it went into.
  return outer ? growContainerToFit(grouped, outer.id) : grouped;
}

/** Where a new block should go inside a container: below its lowest child. */
export function nextSlotInContainer(nodes: DiagramNode[], containerId: string): Position {
  const children = childrenOf(nodes, containerId);
  const insets = insetsOf(nodes, containerId);
  if (!children.length) return { x: insets.left, y: insets.top };
  const lowest = Math.max(...children.map((c) => c.position.y + c.size.height));
  return { x: insets.left, y: lowest + LAYOUT_GAP };
}

/**
 * Applies a style change to a container. Moving the header to another side shifts the
 * children and resizes the container, so nothing ends up under the header.
 */
export function restyleContainer(nodes: DiagramNode[], containerId: string, patch: ContainerStyle): DiagramNode[] {
  const container = nodes.find((node) => node.id === containerId);
  if (!container || container.data.kind !== "container") return nodes;
  const before = containerInsets(container.data);
  const after = containerInsets({ ...container.data, ...patch });
  const dx = after.left - before.left;
  const dy = after.top - before.top;
  const hasChildren = nodes.some((node) => node.parentId === containerId);

  const restyled = nodes.map((node) => {
    if (node.id === containerId) {
      return {
        ...node,
        data: { ...node.data, ...patch },
        size: hasChildren
          ? {
              width: Math.max(CONTAINER_MIN.width, node.size.width + dx + after.right - before.right),
              height: Math.max(CONTAINER_MIN.height, node.size.height + dy + after.bottom - before.bottom),
            }
          : node.size,
      };
    }
    if (node.parentId === containerId && (dx || dy)) {
      return { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } };
    }
    return node;
  });
  return container.parentId ? growContainerToFit(restyled, container.parentId) : restyled;
}

/**
 * Moves the given nodes by (dx, dy). A container carries its contents, so a box is only moved
 * when no container it's in is moving. Children stay inside their container's header/padding on the top and
 * left, and the container grows to fit them on the bottom and right (as when dragging).
 */
export function nudgeNodes(nodes: DiagramNode[], ids: string[], dx: number, dy: number): DiagramNode[] {
  const moving = new Set(ids);
  const touchedParents = new Set<string>();
  let next = nodes.map((node) => {
    if (!moving.has(node.id) || hasAncestorIn(node, nodes, moving)) return node;
    let x = node.position.x + dx;
    let y = node.position.y + dy;
    if (node.parentId) {
      const insets = insetsOf(nodes, node.parentId);
      x = Math.max(insets.left, x);
      y = Math.max(insets.top, y);
      touchedParents.add(node.parentId);
    }
    return { ...node, position: { x, y } };
  });
  for (const parentId of touchedParents) next = growContainerToFit(next, parentId);
  return next;
}
