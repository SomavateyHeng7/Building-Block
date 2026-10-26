import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";
import { connectionPath, fromFlowNodes, toFlowEdges, toFlowNodes } from "@/lib/diagram/flowAdapter";
import type { ChangeMarks } from "@/lib/diagram/compare";
import type { DiagramEdge, DiagramNode } from "@/lib/diagram/types";

const ends = { sourceX: 0, sourceY: 0, sourcePosition: Position.Right, targetX: 200, targetY: 100, targetPosition: Position.Left };

describe("connectionPath", () => {
  it("puts the middle of each shape between the ends when there is no bend", () => {
    for (const shape of ["step", "curved", "straight"] as const) {
      const { labelX, labelY } = connectionPath(ends, shape);
      expect([labelX, labelY]).toEqual([100, 50]);
    }
  });

  it("moves the middle by the bend", () => {
    expect(connectionPath(ends, "straight", { x: 0, y: 80 })).toEqual({ path: "M 0,0 L 100,130 L 200,100", labelX: 100, labelY: 130 });
    // The curve passes through the moved middle: its control point is twice as far out.
    expect(connectionPath(ends, "curved", { x: 0, y: 80 })).toEqual({ path: "M 0,0 Q 100,210 200,100", labelX: 100, labelY: 130 });
    // A right-angled line between left and right sides moves its vertical middle segment sideways.
    const step = connectionPath(ends, "step", { x: 40, y: 0 });
    expect(step.labelX).toBe(140);
    expect(step.path).not.toBe(connectionPath(ends, "step").path);
  });
});

describe("change marks on the canvas", () => {
  const marks: ChangeMarks = {
    nodes: new Map([["a", "added"]]),
    edges: new Map([["e", "removed"]]),
    legend: [],
  };

  it("tags marked nodes with a class for their change", () => {
    const nodes = [
      { id: "a", type: "block", position: { x: 0, y: 0 }, size: { width: 160, height: 56 }, data: { kind: "block", label: "A", containerId: null } },
      { id: "b", type: "block", position: { x: 0, y: 0 }, size: { width: 160, height: 56 }, data: { kind: "block", label: "B", containerId: null } },
    ] satisfies DiagramNode[];
    expect(toFlowNodes(nodes, new Set(), marks).map((node) => node.className)).toEqual(["bb-change bb-change-added", undefined]);
  });

  it("draws marked connections in their change's colour, and passes route and bend to the line", () => {
    const edges: DiagramEdge[] = [
      { id: "e", source: "a", target: "b", shape: "curved", bend: { x: 8, y: 0 } },
      { id: "f", source: "a", target: "b" },
    ];
    const [removed, plain] = toFlowEdges(edges, null, false, marks);
    expect(removed.style?.stroke).toBe("#dc2626");
    expect(removed.data).toEqual({ shape: "curved", bend: { x: 8, y: 0 } });
    expect(plain.style?.stroke).toBe("#52525b");
    expect(plain.data).toEqual({ shape: "step" });
  });
});

describe("fromFlowNodes", () => {
  const nodes = [
    { id: "a", type: "block", position: { x: 0, y: 0 }, size: { width: 160, height: 56 }, data: { kind: "block", label: "A", containerId: null } },
    { id: "b", type: "block", position: { x: 200, y: 0 }, size: { width: 160, height: 56 }, data: { kind: "block", label: "B", containerId: null } },
  ] satisfies DiagramNode[];

  it("keeps the objects of nodes that didn't change, so undo history shares them", () => {
    const flow = toFlowNodes(nodes, new Set());
    const moved = flow.map((node) => (node.id === "a" ? { ...node, position: { x: 8, y: 0 } } : node));
    const [a, b] = fromFlowNodes(moved, nodes);
    expect(a).not.toBe(nodes[0]);
    expect(a.position).toEqual({ x: 8, y: 0 });
    expect(b).toBe(nodes[1]);
  });

  it("makes new objects for resized nodes, and without the previous nodes", () => {
    const flow = toFlowNodes(nodes, new Set());
    expect(fromFlowNodes([{ ...flow[0], width: 200 }], nodes)[0].size).toEqual({ width: 200, height: 56 });
    expect(fromFlowNodes(flow)[1]).not.toBe(nodes[1]);
  });
});
