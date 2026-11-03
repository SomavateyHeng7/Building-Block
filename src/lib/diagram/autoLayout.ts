import { CONTAINER_MIN, absolutePosition, containerInsets, LAYOUT_GAP, suggestConnectionSides } from "./layout";
import type { DiagramEdge, DiagramNode, Position, Size } from "./types";

export type TidyDirection = "LR" | "TB";

/** Space between the columns (or rows) of boxes, and between boxes in one column. */
const GAP_ACROSS = 150;
const GAP_ACROSS_TB = 100;
const GAP_ALONG = 40;
/** Components in one container stack this many deep (left to right) or this many wide (top to bottom). */
const STACK_LR = 6;
const STACK_TB = 4;
/** Boxes with no connections wrap into columns no taller than this, or than the tallest connected column. */
const LOOSE_HEIGHT = 800;

interface Item {
  id: string;
  size: Size;
  /** Where its components go, relative to it, for a container. */
  inside?: Map<string, Position>;
  /** Where it was, to keep the order people had. */
  was: Position;
}

/**
 * A neat layout for the whole tab: containers (and loose components) are arranged in columns following the flow
 * of the connections, left to right, or in rows from top to bottom. Each box goes one step after the ones that
 * lead to it; loop-backs don't count. Boxes in a column are ordered to keep connections short, containers are
 * wrapped round their components, and connections are re-attached to the sides that face each other with any
 * bends cleared. Sizes of components stay as they are. Boxes with no connections go in columns after the rest.
 */
export function tidyLayout(
  nodes: DiagramNode[],
  edges: readonly DiagramEdge[],
  direction: TidyDirection,
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const lr = direction === "LR";
  const known = new Set(nodes.map((node) => node.id));
  const containers = nodes.filter((node) => node.type === "container");
  const containerIds = new Set(containers.map((node) => node.id));
  const itemIdOf = (node: DiagramNode) => (node.parentId && containerIds.has(node.parentId) ? node.parentId : node.id);

  // What was where, so the order people had is kept wherever the flow doesn't decide.
  const was = (node: DiagramNode) => absolutePosition(node, nodes);
  const readingOrder = (a: Position, b: Position) => (lr ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x);

  const items = new Map<string, Item>();
  for (const node of nodes) {
    if (node.parentId && containerIds.has(node.parentId)) continue;
    items.set(node.id, { id: node.id, size: node.size, was: was(node) });
  }
  for (const container of containers) {
    const children = nodes
      .filter((node) => node.parentId === container.id)
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    const insets = containerInsets(container.data.kind === "container" ? container.data : undefined);
    const { positions, content } = stack(children, lr);
    const inside = new Map<string, Position>();
    for (const [id, position] of positions) inside.set(id, { x: insets.left + position.x, y: insets.top + position.y });
    items.set(container.id, {
      id: container.id,
      size: children.length
        ? {
            width: Math.max(CONTAINER_MIN.width, insets.left + content.width + insets.right),
            height: Math.max(CONTAINER_MIN.height, insets.top + content.height + insets.bottom),
          }
        : container.size,
      inside,
      was: was(container),
    });
  }

  // Connections between different boxes, as pairs of items.
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = edges
    .filter((edge) => known.has(edge.source) && known.has(edge.target))
    .map((edge) => [itemIdOf(byId.get(edge.source)!), itemIdOf(byId.get(edge.target)!)] as const)
    .filter(([from, to]) => from !== to && items.has(from) && items.has(to));

  const order = [...items.values()].sort((a, b) => readingOrder(a.was, b.was) || a.id.localeCompare(b.id)).map((item) => item.id);
  const rank = layers(order, links);

  const connected = new Set(links.flat());
  const columns: string[][] = [];
  for (const id of order) {
    if (!connected.has(id)) continue;
    const column = rank.get(id) ?? 0;
    (columns[column] ??= []).push(id);
  }
  const placed = columns.filter(Boolean);
  reduceCrossings(placed, links, order);

  // Positions of each item, top-left, in the layout's own space (x across columns, y along them).
  const origin = new Map<string, Position>();
  const across = (item: Item) => (lr ? item.size.width : item.size.height);
  const along = (item: Item) => (lr ? item.size.height : item.size.width);
  const gap = lr ? GAP_ACROSS : GAP_ACROSS_TB;

  const lengths = placed.map((ids) => ids.reduce((sum, id) => sum + along(items.get(id)!), 0) + GAP_ALONG * (ids.length - 1));
  const longest = Math.max(0, ...lengths);
  let cursor = 0;
  placed.forEach((ids, index) => {
    const thickness = Math.max(...ids.map((id) => across(items.get(id)!)));
    let offset = (longest - lengths[index]) / 2;
    for (const id of ids) {
      const item = items.get(id)!;
      origin.set(id, lr ? { x: cursor, y: offset } : { x: offset, y: cursor });
      offset += along(item) + GAP_ALONG;
    }
    cursor += thickness + gap;
  });

  // Boxes with no connections follow, wrapping so they don't make one huge column.
  const loose = order.filter((id) => !connected.has(id));
  if (loose.length) {
    const limit = Math.max(LOOSE_HEIGHT, longest);
    let start = placed.length ? cursor : 0;
    let offset = 0;
    let thickness = 0;
    for (const id of loose) {
      const item = items.get(id)!;
      if (offset > 0 && offset + along(item) > limit) {
        start += thickness + gap;
        offset = 0;
        thickness = 0;
      }
      origin.set(id, lr ? { x: start, y: offset } : { x: offset, y: start });
      offset += along(item) + GAP_ALONG;
      thickness = Math.max(thickness, across(item));
    }
  }

  const laidOut = nodes.map((node) => {
    const item = items.get(node.id);
    if (item) {
      const at = origin.get(node.id)!;
      return { ...node, position: at, size: node.type === "container" ? item.size : node.size };
    }
    const parent = node.parentId ? items.get(node.parentId) : undefined;
    const inside = parent?.inside?.get(node.id);
    return inside ? { ...node, position: inside } : node;
  });

  const tidied = edges.map((edge) => {
    if (!known.has(edge.source) || !known.has(edge.target)) return { ...edge };
    const { bend, ...rest } = edge;
    void bend;
    return { ...rest, ...suggestConnectionSides(laidOut, edge.source, edge.target) };
  });
  return { nodes: laidOut, edges: tidied };
}

/** Components stacked in columns (left to right) or rows (top to bottom), in the order given. */
function stack(children: DiagramNode[], lr: boolean): { positions: Map<string, Position>; content: Size } {
  const positions = new Map<string, Position>();
  if (!children.length) return { positions, content: { width: 0, height: 0 } };
  const perLine = lr ? Math.min(children.length, STACK_LR) : Math.min(children.length, STACK_TB);
  const lines: DiagramNode[][] = [];
  children.forEach((child, index) => {
    (lines[Math.floor(index / perLine)] ??= []).push(child);
  });
  // LR: each line is a column of components. TB: each line is a row.
  let offset = 0;
  let thickness = 0;
  let length = 0;
  for (const line of lines) {
    const lineThickness = Math.max(...line.map((child) => (lr ? child.size.width : child.size.height)));
    let at = 0;
    for (const child of line) {
      positions.set(child.id, lr ? { x: offset, y: at } : { x: at, y: offset });
      at += (lr ? child.size.height : child.size.width) + LAYOUT_GAP;
    }
    length = Math.max(length, at - LAYOUT_GAP);
    offset += lineThickness + LAYOUT_GAP;
    thickness = offset - LAYOUT_GAP;
  }
  return { positions, content: lr ? { width: thickness, height: length } : { width: length, height: thickness } };
}

/**
 * Each item's layer: one after the latest item leading to it. Connections that run back to an item still being
 * visited (loops) are ignored, so a cycle doesn't stack everything in one layer.
 */
function layers(order: readonly string[], links: readonly (readonly [string, string])[]): Map<string, number> {
  const out = new Map<string, string[]>();
  for (const [from, to] of links) out.set(from, [...(out.get(from) ?? []), to]);
  const index = new Map(order.map((id, position) => [id, position]));
  for (const list of out.values()) list.sort((a, b) => index.get(a)! - index.get(b)!);

  const state = new Map<string, 1 | 2>(); // 1 = on the way down, 2 = done
  const finished: string[] = [];
  const back = new Set<string>();
  const visit = (start: string) => {
    const stackOfWork: { id: string; next: number }[] = [{ id: start, next: 0 }];
    state.set(start, 1);
    while (stackOfWork.length) {
      const top = stackOfWork[stackOfWork.length - 1];
      const children = out.get(top.id) ?? [];
      if (top.next < children.length) {
        const child = children[top.next++];
        if (state.get(child) === 1) back.add(`${top.id}>${child}`);
        else if (!state.has(child)) {
          state.set(child, 1);
          stackOfWork.push({ id: child, next: 0 });
        }
      } else {
        state.set(top.id, 2);
        finished.push(top.id);
        stackOfWork.pop();
      }
    }
  };
  for (const id of order) if (!state.has(id)) visit(id);

  const rank = new Map<string, number>();
  for (const id of order) rank.set(id, 0);
  for (const id of [...finished].reverse()) {
    for (const child of out.get(id) ?? []) {
      if (back.has(`${id}>${child}`)) continue;
      rank.set(child, Math.max(rank.get(child) ?? 0, (rank.get(id) ?? 0) + 1));
    }
  }
  return rank;
}

/** Orders each column by the average place of the items it connects to in the neighbouring columns; a few sweeps. */
function reduceCrossings(columns: string[][], links: readonly (readonly [string, string])[], order: readonly string[]) {
  const initial = new Map(order.map((id, position) => [id, position]));
  const neighbours = new Map<string, string[]>();
  for (const [from, to] of links) {
    neighbours.set(from, [...(neighbours.get(from) ?? []), to]);
    neighbours.set(to, [...(neighbours.get(to) ?? []), from]);
  }
  const sweep = (column: number, toward: number) => {
    const at = new Map(columns[toward].map((id, position) => [id, position]));
    const average = (id: string) => {
      const places = (neighbours.get(id) ?? []).flatMap((other) => (at.has(other) ? [at.get(other)!] : []));
      return places.length ? places.reduce((sum, value) => sum + value, 0) / places.length : null;
    };
    const keyed = columns[column].map((id, position) => ({ id, position, average: average(id) }));
    // Items with nothing to go by keep their slot's place.
    keyed.sort(
      (a, b) =>
        (a.average ?? a.position) - (b.average ?? b.position) || initial.get(a.id)! - initial.get(b.id)!,
    );
    columns[column] = keyed.map((entry) => entry.id);
  };
  for (let round = 0; round < 3; round++) {
    for (let column = 1; column < columns.length; column++) sweep(column, column - 1);
    for (let column = columns.length - 2; column >= 0; column--) sweep(column, column + 1);
  }
}
