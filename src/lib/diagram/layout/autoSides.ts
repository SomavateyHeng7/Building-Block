import { facingSides } from "./layout";
import type { Diagram, DiagramEdge, DiagramNode, Position, Size } from "../types";

interface Canvas {
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
}

// The edges last worked out for each canvas's nodes and edges, so an unchanged canvas costs nothing.
const cache = new WeakMap<DiagramNode[], { edges: DiagramEdge[]; result: DiagramEdge[] }>();

/**
 * Connections with `autoSides` take the sides that face each other, given where their components are now.
 * Returns the same array when none changes; a changed connection keeps everything else, its bend included.
 */
export function autoSideEdges(nodes: DiagramNode[], edges: DiagramEdge[]): DiagramEdge[] {
  if (!edges.some((edge) => edge.autoSides)) return edges;
  const cached = cache.get(nodes);
  if (cached?.edges === edges) return cached.result;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const boxes = new Map<string, Position & Size>();
  const box = (id: string): (Position & Size) | undefined => {
    const known = boxes.get(id);
    if (known) return known;
    const node = byId.get(id);
    if (!node) return undefined;
    let { x, y } = node.position;
    const seen = new Set([node.id]);
    for (let parent = node.parentId ? byId.get(node.parentId) : undefined; parent && !seen.has(parent.id); parent = parent.parentId ? byId.get(parent.parentId) : undefined) {
      seen.add(parent.id);
      x += parent.position.x;
      y += parent.position.y;
    }
    const found = { x, y, ...node.size };
    boxes.set(id, found);
    return found;
  };

  let changed = false;
  const result = edges.map((edge) => {
    if (!edge.autoSides) return edge;
    const from = box(edge.source);
    const to = box(edge.target);
    if (!from || !to) return edge;
    const { sourceSide, targetSide } = facingSides(from, to);
    if (edge.sourceSide === sourceSide && edge.targetSide === targetSide) return edge;
    changed = true;
    return { ...edge, sourceSide, targetSide };
  });
  const out = changed ? result : edges;
  cache.set(nodes, { edges, result: out });
  return out;
}

// What each tab or internal design came out as: unchanged ones (most, on every edit) are skipped.
const canvasCache = new WeakMap<Canvas, Canvas>();

function onCanvas<T extends Canvas>(canvas: T): T {
  const known = canvasCache.get(canvas);
  if (known) return known as T;
  const result = settle(canvas);
  canvasCache.set(canvas, result);
  canvasCache.set(result, result);
  return result;
}

function settle<T extends Canvas>(canvas: T): T {
  // An internal design's connections follow its own components.
  let nodesChanged = false;
  const nodes = canvas.nodes.map((node) => {
    const detail = node.data.kind === "block" ? node.data.detail : undefined;
    if (!detail?.edges?.length) return node;
    const next = onCanvas(detail);
    if (next === detail) return node;
    nodesChanged = true;
    return { ...node, data: { ...node.data, detail: next } } as DiagramNode;
  });
  const edges = canvas.edges?.length ? autoSideEdges(nodes, canvas.edges) : canvas.edges;
  if (!nodesChanged && edges === canvas.edges) return canvas;
  return { ...canvas, nodes: nodesChanged ? nodes : canvas.nodes, edges };
}

/** Sets the sides of every `autoSides` connection in the diagram. Returns the same diagram when nothing changes. */
export function withAutoSides<T extends Pick<Diagram, "sections">>(diagram: T): T {
  let changed = false;
  const sections = diagram.sections.map((section) => {
    const next = onCanvas(section);
    if (next !== section) changed = true;
    return next;
  });
  return changed ? { ...diagram, sections } : diagram;
}
