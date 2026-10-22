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
}

export interface CanvasSpec {
  /** Left to right; each column holds one or more containers stacked top to bottom. */
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

interface Placed {
  id: string;
  column: number;
  /** Canvas y of the component's top edge, to tell which of two components in a column is higher. */
  top: number;
}

/** Facing sides: across columns left to right, or top to bottom within one. */
function sidesBetween(source: Placed, target: Placed): [ConnectionSide, ConnectionSide] {
  if (source.column < target.column) return ["right", "left"];
  if (source.column > target.column) return ["left", "right"];
  return source.top <= target.top ? ["bottom", "top"] : ["top", "bottom"];
}

export function buildCanvas(spec: CanvasSpec, { withDetails = true } = {}): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes: DiagramNode[] = [];
  const placed = new Map<string, Placed>();

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

      container.components.forEach(({ label, colorKey, detail, ...details }, rowIndex) => {
        const id = createId("block");
        const top = BLOCK_TOP_OFFSET + rowIndex * (BLOCK_HEIGHT + BLOCK_GAP_Y);
        placed.set(label, { id, column: columnIndex, top: y + top });
        const inner = detail && withDetails ? buildCanvas(detail, { withDetails: false }) : null;
        nodes.push({
          id,
          type: "block",
          position: { x: BLOCK_LEFT, y: top },
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
        });
      });

      y += height + CONTAINER_GAP_Y;
    }
  });

  const edges = (spec.connections ?? []).flatMap((connection): DiagramEdge[] => {
    const source = placed.get(connection.from);
    const target = placed.get(connection.to);
    if (!source || !target) return [];
    const [sourceSide, targetSide] = sidesBetween(source, target);
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

  return { nodes, edges };
}

/** A diagram with the default legend and one tab per entry; the first tab opens. */
export function buildDiagram(name: string, tabs: { name: string; canvas: CanvasSpec }[]): Diagram {
  const sections: DiagramSection[] = tabs.map((tab) => {
    const { nodes, edges } = buildCanvas(tab.canvas);
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
