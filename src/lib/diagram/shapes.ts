import type { BlockShape, DiagramNode } from "./types";

/**
 * The flowchart shapes, as draw.io's Flowchart palette offers them: what each means, its usual size, and its
 * outline as an SVG path in a 100 × 100 box (drawn stretched to the shape's size). "process" and "terminal" are
 * drawn with CSS (a box, a pill), so they have no path.
 */
export interface ShapeInfo {
  shape: BlockShape;
  label: string;
  /** What a new one is called. */
  defaultName: string;
  hint: string;
  size: { width: number; height: number };
  /** Undefined for the shapes drawn as a plain box or pill. */
  path?: string;
  /** Lines drawn on top of the fill (a cylinder's rim, a subprocess's inner sides). */
  detail?: string;
  /** How far in from the left and right the label keeps, in % of the width (a diamond's corners, a slant). */
  inset: number;
}

export const SHAPES: ShapeInfo[] = [
  { shape: "process", label: "Process", defaultName: "Step", hint: "A step: something done", size: { width: 160, height: 56 }, inset: 0 },
  { shape: "decision", label: "Decision", defaultName: "Decision?", hint: "A question with Yes / No ways out", size: { width: 160, height: 96 }, path: "M50 0L100 50L50 100L0 50Z", inset: 22 },
  { shape: "terminal", label: "Start / end", defaultName: "Start", hint: "Where the flow starts or ends", size: { width: 160, height: 48 }, inset: 0 },
  { shape: "data", label: "Data", defaultName: "Input", hint: "Data in or out: a form, a file, a message", size: { width: 160, height: 56 }, path: "M15 0H100L85 100H0Z", inset: 14 },
  { shape: "document", label: "Document", defaultName: "Document", hint: "A document or report", size: { width: 160, height: 64 }, path: "M0 0H100V82C75 70 50 100 25 92C15 89 7 86 0 88Z", inset: 0 },
  {
    shape: "database",
    label: "Database",
    defaultName: "Database",
    hint: "Stored data",
    size: { width: 120, height: 80 },
    path: "M0 12C0 -4 100 -4 100 12V88C100 104 0 104 0 88Z",
    detail: "M0 12C0 28 100 28 100 12",
    inset: 0,
  },
  { shape: "subprocess", label: "Subprocess", defaultName: "Subprocess", hint: "A process defined elsewhere", size: { width: 160, height: 56 }, path: "M0 0H100V100H0Z", detail: "M8 0V100M92 0V100", inset: 8 },
];

export function shapeInfo(shape: BlockShape | undefined): ShapeInfo {
  return SHAPES.find((info) => info.shape === (shape ?? "process")) ?? SHAPES[0];
}

// Worked out once per nodes array (every edit makes a new one), so asking per box costs nothing on big diagrams.
const flowchartCache = new WeakMap<readonly DiagramNode[], boolean>();

/**
 * Whether a canvas is a flowchart: it has a component drawn as a flowchart shape (a decision, a pill…). Flowcharts
 * get draw.io's quick-add arrows, and aren't checked for owners or protocols (which are architecture questions).
 */
export function isFlowchart(nodes: readonly DiagramNode[]): boolean {
  let flowchart = flowchartCache.get(nodes);
  if (flowchart === undefined) {
    flowchart = nodes.some((node) => node.data.kind === "block" && node.data.shape !== undefined);
    flowchartCache.set(nodes, flowchart);
  }
  return flowchart;
}
