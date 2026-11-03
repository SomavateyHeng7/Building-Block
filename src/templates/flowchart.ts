import { createBlankDiagram, createBlankSection, createId } from "@/lib/diagram/factory";
import type { BlockShape, ConnectionSide, DiagramEdge, DiagramNode, LegendEntry } from "@/lib/diagram/types";
import type { TemplateDefinition } from "./types";

/**
 * A process flowchart, top to bottom: pills start and end it, boxes are steps, diamonds are decisions with
 * Yes/No ways out. Laid out by hand (to the pixel) rather than in containers, as a flowchart isn't grouped.
 */

const LEGEND: LegendEntry[] = [
  { key: "terminal", label: "Start / end", color: "#8fd19e" },
  { key: "step", label: "Step", color: "#dbeafe" },
  { key: "decision", label: "Decision", color: "#f6d860" },
  { key: "exception", label: "Exception path", color: "#fca5a5" },
];

const MAIN_X = 200;
const BRANCH_X = 520;
const WIDTH = 200;
const HEIGHT: Record<BlockShape, number> = { terminal: 48, process: 56, decision: 96 };

interface StepSpec {
  key: string;
  label: string;
  shape: BlockShape;
  colorKey: string;
  x: number;
  y: number;
  description?: string;
}

const STEPS: StepSpec[] = [
  { key: "start", label: "Order received", shape: "terminal", colorKey: "terminal", x: MAIN_X, y: 100 },
  { key: "validate", label: "Validate order", shape: "process", colorKey: "step", x: MAIN_X, y: 196, description: "Check stock, address and order limits." },
  { key: "valid", label: "Order valid?", shape: "decision", colorKey: "decision", x: MAIN_X, y: 300 },
  { key: "notify", label: "Tell customer what's wrong", shape: "process", colorKey: "exception", x: BRANCH_X, y: 320 },
  { key: "rejected", label: "Order rejected", shape: "terminal", colorKey: "terminal", x: BRANCH_X, y: 428 },
  { key: "pay", label: "Take payment", shape: "process", colorKey: "step", x: MAIN_X, y: 448 },
  { key: "paid", label: "Payment approved?", shape: "decision", colorKey: "decision", x: MAIN_X, y: 552 },
  { key: "cancel", label: "Cancel and release stock", shape: "process", colorKey: "exception", x: BRANCH_X, y: 572 },
  { key: "cancelled", label: "Order cancelled", shape: "terminal", colorKey: "terminal", x: BRANCH_X, y: 680 },
  { key: "ship", label: "Pack and ship", shape: "process", colorKey: "step", x: MAIN_X, y: 700 },
  { key: "done", label: "Order complete", shape: "terminal", colorKey: "terminal", x: MAIN_X, y: 804 },
];

/** [from, to, label]; a branch to the right leaves a decision's right corner, everything else flows down. */
const FLOWS: [string, string, string?][] = [
  ["start", "validate"],
  ["validate", "valid"],
  ["valid", "pay", "Yes"],
  ["valid", "notify", "No"],
  ["notify", "rejected"],
  ["pay", "paid"],
  ["paid", "ship", "Yes"],
  ["paid", "cancel", "No"],
  ["cancel", "cancelled"],
  ["ship", "done"],
];

function buildCanvas(): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const ids = new Map(STEPS.map((step) => [step.key, createId("block")]));
  const nodes: DiagramNode[] = [
    {
      id: createId("text"),
      type: "text",
      position: { x: MAIN_X, y: 0 },
      size: { width: 520, height: 32 },
      data: { kind: "text", label: "Order fulfilment flow", fontSize: 20, bold: true },
    },
    {
      id: createId("text"),
      type: "text",
      position: { x: MAIN_X, y: 40 },
      size: { width: 520, height: 24 },
      data: { kind: "text", label: "Pill: start or end · Box: a step · Diamond: a decision. Double-click anything to rename it." },
    },
    ...STEPS.map(
      (step): DiagramNode => ({
        id: ids.get(step.key)!,
        type: "block",
        position: { x: step.x, y: step.y },
        size: { width: WIDTH, height: HEIGHT[step.shape] },
        data: {
          kind: "block",
          label: step.label,
          colorKey: step.colorKey,
          containerId: null,
          ...(step.shape === "process" ? {} : { shape: step.shape }),
          ...(step.description ? { description: step.description } : {}),
        },
      }),
    ),
  ];
  const byKey = new Map(STEPS.map((step) => [step.key, step]));
  const edges = FLOWS.map(([from, to, label]): DiagramEdge => {
    const across = byKey.get(to)!.x > byKey.get(from)!.x;
    const [sourceSide, targetSide]: ConnectionSide[] = across ? ["right", "left"] : ["bottom", "top"];
    return {
      id: createId("edge"),
      source: ids.get(from)!,
      target: ids.get(to)!,
      sourceSide,
      targetSide,
      ...(label ? { label } : {}),
    };
  });
  return { nodes, edges };
}

export const flowchartTemplate: TemplateDefinition = {
  id: "flowchart",
  name: "Flowchart",
  description: "A process from start to end, with steps, Yes/No decisions and the exception paths they lead to.",
  build: () => {
    const diagram = createBlankDiagram("Order Fulfilment Flowchart");
    const section = { ...createBlankSection("Flow"), ...buildCanvas() };
    return { ...diagram, legend: LEGEND, sections: [section], activeSectionId: section.id };
  },
};
