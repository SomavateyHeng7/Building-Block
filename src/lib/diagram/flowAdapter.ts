import {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  MarkerType,
  type Edge,
  type Node,
  type Position as Side,
} from "@xyflow/react";
import { CHANGE_COLORS, type ChangeMarks } from "./compare";
import type { DiagramEdge, DiagramNode, DiagramNodeData, Position } from "./types";

export type FlowNode = Node<DiagramNodeData>;

/** What the custom connection line (`ConnectionEdge`) needs beyond React Flow's own edge fields. */
export interface ConnectionEdgeData extends Record<string, unknown> {
  shape: NonNullable<DiagramEdge["shape"]>;
  bend?: Position;
}

export type FlowEdge = Edge<ConnectionEdgeData, "connection">;

// The flow node last made for each diagram node, reused while the node, its selection and its mark are the same.
const flowNodeCache = new WeakMap<DiagramNode, { selected: boolean; className: string | undefined; flow: FlowNode }>();

/**
 * React Flow needs parents before their children, so containers are listed first. With `marks`, changed
 * nodes get a `bb-change-*` class that outlines and tags them (see globals.css).
 *
 * **Why the cache and `measured`:** React Flow rebuilds its record of every node object it hasn't seen before, and
 * without `measured` it forgets where that node's connection dots are, hiding its connections until it measures
 * the node again. Rebuilding every node on each frame of a drag made every connection on the tab unmount and
 * remount, measuring its label each time: a few frames a second on big diagrams. Unchanged nodes now keep their
 * object, and changed ones say their size (already known) so their dots are kept.
 */
export function toFlowNodes(nodes: DiagramNode[], selectedIds: ReadonlySet<string>, marks?: ChangeMarks | null): FlowNode[] {
  const ordered = [
    ...nodes.filter((node) => node.type === "container"),
    ...nodes.filter((node) => node.type !== "container"),
  ];
  return ordered.map((node) => {
    const selected = selectedIds.has(node.id);
    const className = marks?.nodes.has(node.id) ? `bb-change bb-change-${marks.nodes.get(node.id)}` : undefined;
    const cached = flowNodeCache.get(node);
    if (cached && cached.selected === selected && cached.className === className) return cached.flow;
    const flow: FlowNode = {
      id: node.id,
      type: node.type,
      position: node.position,
      width: node.size.width,
      height: node.size.height,
      measured: { width: node.size.width, height: node.size.height },
      // No `extent: "parent"`: components can be dragged out of their container (see dropIntoContainers).
      parentId: node.parentId,
      zIndex: node.zIndex,
      selected,
      className,
      data: node.data,
    };
    flowNodeCache.set(node, { selected, className, flow });
    return flow;
  });
}

/**
 * With `previous` (the nodes the flow nodes were made from), an unchanged node keeps its object, so undo
 * history shares it instead of keeping a copy of the whole tab per step.
 */
export function fromFlowNodes(flowNodes: FlowNode[], previous: readonly DiagramNode[] = []): DiagramNode[] {
  const byId = new Map(previous.map((node) => [node.id, node]));
  return flowNodes.map((node) => {
    const width = node.width ?? node.measured?.width ?? 160;
    const height = node.height ?? node.measured?.height ?? 80;
    const old = byId.get(node.id);
    if (
      old &&
      old.type === node.type &&
      old.position === node.position &&
      old.size.width === width &&
      old.size.height === height &&
      old.parentId === node.parentId &&
      old.zIndex === node.zIndex &&
      old.data === node.data
    ) {
      return old;
    }
    return {
      id: node.id,
      type: node.type as "container" | "block",
      position: node.position,
      size: { width, height },
      parentId: node.parentId,
      zIndex: node.zIndex,
      data: node.data,
    };
  });
}

/**
 * Undo key for a burst of moves or resizes of the same nodes. Sorted, so the drag itself and the
 * re-parenting at its end produce the same key (and one undo step) whatever order the ids come in.
 */
export function historyKey(kind: "move" | "resize", ids: string[]): string {
  return `${kind}:${[...ids].sort().join(",")}`;
}

/** What a connection says on the canvas: "Orders · REST", or whichever half exists. */
export function connectionCaption(edge: Pick<DiagramEdge, "label" | "protocol">): string {
  return [edge.label, edge.protocol].filter(Boolean).join(" · ");
}

/** With `marks`, changed connections are drawn in their change's colour. */
export function toFlowEdges(
  edges: DiagramEdge[],
  selectedId: string | null,
  dark: boolean,
  marks?: ChangeMarks | null,
): FlowEdge[] {
  return edges.map((edge) => {
    const change = marks?.edges.get(edge.id);
    const color = change ? CHANGE_COLORS[change] : dark ? "#a1a1aa" : "#52525b";
    const direction = edge.direction ?? "forward";
    const marker = { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };
    const caption = connectionCaption(edge);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceSide ?? null,
      targetHandle: edge.targetSide ?? null,
      type: "connection",
      data: { shape: edge.shape ?? "step", ...(edge.bend ? { bend: edge.bend } : {}) },
      selected: edge.id === selectedId,
      interactionWidth: 24,
      label: caption || undefined,
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
      // Explicit colours, not React Flow's CSS variables: image export renders outside the canvas, where those are undefined.
      labelStyle: { fontSize: 11, fontWeight: 500, fill: dark ? "#e4e4e7" : "#18181b" },
      labelBgStyle: { fill: dark ? "#18181b" : "#ffffff", fillOpacity: 1, stroke: change ? color : dark ? "#3f3f46" : "#d4d4d8" },
      markerEnd: direction === "none" ? undefined : marker,
      markerStart: direction === "both" ? marker : undefined,
      style: {
        stroke: edge.id === selectedId ? "#2563eb" : color,
        strokeWidth: edge.id === selectedId || change ? 2.5 : 1.75,
        strokeDasharray: edge.style === "dashed" ? "7 5" : undefined,
      },
    };
  });
}

export interface LineEnds {
  sourceX: number;
  sourceY: number;
  sourcePosition: Side;
  targetX: number;
  targetY: number;
  targetPosition: Side;
}

/**
 * A connection's SVG path and its middle (where the label and the bend dot go). Without a bend each shape is
 * drawn as React Flow draws it. A bend moves the middle: the right-angle line moves its middle segment there,
 * and the curved and straight lines pass through it.
 */
export function connectionPath(ends: LineEnds, shape: ConnectionEdgeData["shape"], bend?: Position) {
  const draw = (): [string, number, number] => {
    if (shape === "curved") return getBezierPath(ends).slice(0, 3) as [string, number, number];
    if (shape === "straight") return getStraightPath(ends).slice(0, 3) as [string, number, number];
    return getSmoothStepPath({ ...ends, borderRadius: 5 }).slice(0, 3) as [string, number, number];
  };
  const [path, labelX, labelY] = draw();
  if (!bend || (!bend.x && !bend.y)) return { path, labelX, labelY };

  const x = labelX + bend.x;
  const y = labelY + bend.y;
  const { sourceX, sourceY, targetX, targetY } = ends;
  if (shape === "step") {
    const [bent, bentX, bentY] = getSmoothStepPath({ ...ends, borderRadius: 5, centerX: x, centerY: y });
    return { path: bent, labelX: bentX, labelY: bentY };
  }
  if (shape === "straight") return { path: `M ${sourceX},${sourceY} L ${x},${y} L ${targetX},${targetY}`, labelX: x, labelY: y };
  // A quadratic curve passes through its middle when the control point is twice as far from the chord's middle.
  const controlX = 2 * x - (sourceX + targetX) / 2;
  const controlY = 2 * y - (sourceY + targetY) / 2;
  return { path: `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`, labelX: x, labelY: y };
}
