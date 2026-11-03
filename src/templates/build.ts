import type { ComponentIconKey } from "@/lib/diagram/componentIcons";
import { createId } from "@/lib/diagram/factory";
import { DEFAULT_LEGEND } from "@/lib/diagram/defaultLegend";
import type {
  BlockColorKey,
  ConnectionSide,
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramSection,
  NodeDetails,
} from "@/lib/diagram/types";

/**
 * Templates are written as data: columns of containers, each holding components, plus connections between
 * components by name. This lays them out and mints fresh ids on every call, so two diagrams from the same
 * template never share ids.
 */

export interface ComponentSpec extends NodeDetails {
  label: string;
  colorKey: BlockColorKey;
  icon?: ComponentIconKey;
  /** The component's internal design (L2). */
  detail?: CanvasSpec;
}

export interface ContainerSpec {
  label: string;
  components: ComponentSpec[];
}

export interface ConnectionSpec {
  /** Component names on the same canvas. */
  from: string;
  to: string;
  /** What flows. */
  label: string;
  protocol?: string;
  description?: string;
  /** The usual convention for asynchronous calls. */
  dashed?: boolean;
  both?: boolean;
  /** Override the facing sides, e.g. to route a loop-back over the top instead of along the forward line. */
  sides?: [ConnectionSide, ConnectionSide];
}

/** Which way lanes run: "vertical" lanes are columns left to right, "horizontal" lanes are rows top to bottom. */
export type Orientation = "vertical" | "horizontal";

export interface BuildOptions {
  orientation?: Orientation;
}

export interface CanvasSpec {
  /**
   * Left to right; each column holds one or more containers stacked top to bottom.
   * Built horizontally, every container becomes a lane (a row) in this order, columns first.
   */
  columns: ContainerSpec[][];
  connections?: ConnectionSpec[];
}

const CONTAINER_WIDTH = 300;
// Wide enough for a connection label to sit between two columns.
const CONTAINER_GAP_X = 150;
const CONTAINER_GAP_Y = 40;
const CANVAS_TOP = 60;
const BLOCK_LEFT = 20;
const BLOCK_WIDTH = 260;
const BLOCK_HEIGHT = 48;
const BLOCK_GAP_Y = 12;
const BLOCK_TOP_OFFSET = 48;
const CONTAINER_BOTTOM_PADDING = 16;
// Horizontal lanes: a step sits in the slot its place in the flow gives it, so lanes line up in time.
const SLOT_GAP_X = 90;
const LANE_GAP_Y = 70;

interface Placed {
  id: string;
  /** The column (vertical lanes) or the lane row (horizontal lanes) it sits in. */
  lane: number;
  /** Where along the lane: canvas y of the top edge (vertical) or the slot number (horizontal). */
  along: number;
}

/** Facing sides: across columns left to right, or top to bottom within one. */
function sidesBetween(source: Placed, target: Placed): [ConnectionSide, ConnectionSide] {
  if (source.lane < target.lane) return ["right", "left"];
  if (source.lane > target.lane) return ["left", "right"];
  return source.along <= target.along ? ["bottom", "top"] : ["top", "bottom"];
}

/** Facing sides between rows: down or up across lanes, left to right along one. */
function sidesBetweenRows(source: Placed, target: Placed): [ConnectionSide, ConnectionSide] {
  if (source.lane < target.lane) return ["bottom", "top"];
  if (source.lane > target.lane) return ["top", "bottom"];
  return source.along <= target.along ? ["right", "left"] : ["left", "right"];
}

/**
 * The slot (column along the lane) of each component: one step after the last step that leads to it. Dashed
 * connections are the loop-backs and rework, so they don't push anything later. Two steps in one lane never
 * share a slot.
 */
function slotsFor(lanes: ContainerSpec[], connections: ConnectionSpec[]): Map<string, number> {
  const depth = new Map<string, number>();
  const names = lanes.flatMap((lane) => lane.components.map((component) => component.label));
  for (const name of names) depth.set(name, 0);
  const forward = connections.filter((connection) => !connection.dashed && depth.has(connection.from) && depth.has(connection.to));
  // One pass per component is enough for any chain; the cap also stops a cycle from growing forever.
  for (let pass = 0; pass < names.length; pass++) {
    let changed = false;
    for (const { from, to } of forward) {
      const next = Math.min(depth.get(from)! + 1, names.length - 1);
      if (next > depth.get(to)!) {
        depth.set(to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const slots = new Map<string, number>();
  for (const lane of lanes) {
    const used = new Set<number>();
    for (const { label } of lane.components) {
      let slot = depth.get(label)!;
      while (used.has(slot)) slot++;
      used.add(slot);
      slots.set(label, slot);
    }
  }
  return slots;
}

export function buildCanvas(
  spec: CanvasSpec,
  { withDetails = true, orientation = "vertical" }: { withDetails?: boolean } & BuildOptions = {},
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes: DiagramNode[] = [];
  const placed = new Map<string, Placed>();
  const horizontal = orientation === "horizontal";
  const lanes = spec.columns.flat();
  const slots = horizontal ? slotsFor(lanes, spec.connections ?? []) : new Map<string, number>();
  const slotCount = Math.max(1, ...Array.from(slots.values(), (slot) => slot + 1));
  const laneWidth = 2 * BLOCK_LEFT + slotCount * BLOCK_WIDTH + (slotCount - 1) * SLOT_GAP_X;
  const laneHeight = BLOCK_TOP_OFFSET + BLOCK_HEIGHT + CONTAINER_BOTTOM_PADDING;

  function makeBlock(component: ComponentSpec, containerId: string, position: { x: number; y: number }): DiagramNode {
    const { label, colorKey, detail, ...details } = component;
    const inner = detail && withDetails ? buildCanvas(detail, { withDetails: false }) : null;
    return {
      id: createId("block"),
      type: "block",
      position,
      size: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT },
      parentId: containerId,
      data: {
        kind: "block",
        label,
        colorKey,
        containerId,
        ...details,
        ...(inner ? { detail: { nodes: inner.nodes, ...(inner.edges.length ? { edges: inner.edges } : {}) } } : {}),
      },
    };
  }

  if (horizontal) {
    lanes.forEach((lane, laneIndex) => {
      const containerId = createId("container");
      const y = CANVAS_TOP + laneIndex * (laneHeight + LANE_GAP_Y);
      nodes.push({
        id: containerId,
        type: "container",
        position: { x: 0, y },
        size: { width: laneWidth, height: laneHeight },
        data: { kind: "container", label: lane.label },
      });
      for (const component of lane.components) {
        const slot = slots.get(component.label)!;
        const block = makeBlock(component, containerId, { x: BLOCK_LEFT + slot * (BLOCK_WIDTH + SLOT_GAP_X), y: BLOCK_TOP_OFFSET });
        placed.set(component.label, { id: block.id, lane: laneIndex, along: slot });
        nodes.push(block);
      }
    });
    return { nodes, edges: buildEdges(spec, placed, sidesBetweenRows) };
  }

  spec.columns.forEach((column, columnIndex) => {
    const x = columnIndex * (CONTAINER_WIDTH + CONTAINER_GAP_X);
    let y = CANVAS_TOP;
    for (const container of column) {
      const containerId = createId("container");
      const height =
        BLOCK_TOP_OFFSET + container.components.length * (BLOCK_HEIGHT + BLOCK_GAP_Y) + CONTAINER_BOTTOM_PADDING;
      nodes.push({
        id: containerId,
        type: "container",
        position: { x, y },
        size: { width: CONTAINER_WIDTH, height },
        data: { kind: "container", label: container.label },
      });

      container.components.forEach((component, rowIndex) => {
        const top = BLOCK_TOP_OFFSET + rowIndex * (BLOCK_HEIGHT + BLOCK_GAP_Y);
        const block = makeBlock(component, containerId, { x: BLOCK_LEFT, y: top });
        placed.set(component.label, { id: block.id, lane: columnIndex, along: y + top });
        nodes.push(block);
      });

      y += height + CONTAINER_GAP_Y;
    }
  });

  return { nodes, edges: buildEdges(spec, placed, sidesBetween) };
}

function buildEdges(
  spec: CanvasSpec,
  placed: Map<string, Placed>,
  sidesFor: (source: Placed, target: Placed) => [ConnectionSide, ConnectionSide],
): DiagramEdge[] {
  return (spec.connections ?? []).flatMap((connection): DiagramEdge[] => {
    const source = placed.get(connection.from);
    const target = placed.get(connection.to);
    if (!source || !target) return [];
    const [sourceSide, targetSide] = connection.sides ?? sidesFor(source, target);
    return [
      {
        id: createId("edge"),
        source: source.id,
        target: target.id,
        sourceSide,
        targetSide,
        label: connection.label,
        ...(connection.protocol ? { protocol: connection.protocol } : {}),
        ...(connection.description ? { description: connection.description } : {}),
        ...(connection.both ? { direction: "both" as const } : {}),
        ...(connection.dashed ? { style: "dashed" as const } : {}),
      },
    ];
  });
}

/** A diagram with the default legend and one tab per entry; the first tab opens. */
export function buildDiagram(
  name: string,
  tabs: { name: string; canvas: CanvasSpec }[],
  options: BuildOptions = {},
): Diagram {
  const sections: DiagramSection[] = tabs.map((tab) => {
    const { nodes, edges } = buildCanvas(tab.canvas, options);
    return { id: createId("section"), name: tab.name, nodes, ...(edges.length ? { edges } : {}) };
  });
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: createId("diagram"),
    name,
    legend: DEFAULT_LEGEND.map((entry) => ({ ...entry })),
    sections,
    activeSectionId: sections[0].id,
    createdAt: now,
    updatedAt: now,
  };
}
