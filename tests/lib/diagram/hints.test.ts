import { describe, expect, it } from "vitest";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { diagramHints } from "@/lib/diagram/hints";
import type { DiagramNode } from "@/lib/diagram/types";

function block(id: string, label: string, owner?: string): DiagramNode {
  return {
    id,
    type: "block",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 50 },
    data: { kind: "block", label, containerId: null, ...(owner ? { owner } : {}) },
  };
}

function diagramWith(nodes: DiagramNode[], edges: { id: string; source: string; target: string; protocol?: string }[] = []) {
  const diagram = createBlankDiagram();
  diagram.sections[0] = { ...diagram.sections[0], nodes, edges };
  return diagram;
}

describe("diagramHints", () => {
  it("is quiet for a complete diagram", () => {
    const diagram = diagramWith([block("a", "Web", "Team A"), block("b", "API", "Team B")], [{ id: "e", source: "a", target: "b", protocol: "REST" }]);
    expect(diagramHints(diagram)).toEqual([]);
  });

  it("flags missing owners, protocols and unconnected components", () => {
    const diagram = diagramWith(
      [block("a", "Web", "Team A"), block("b", "API"), block("c", "Batch", "Team C")],
      [{ id: "e", source: "a", target: "b" }],
    );
    const hints = diagramHints(diagram).map((hint) => `${hint.kind}:${hint.label}`);
    expect(hints).toEqual(expect.arrayContaining(["unconnected:Batch", "no-protocol:Web → API", "no-owner:API"]));
    expect(hints).toHaveLength(3);
  });

  it("doesn't call every component unconnected on a canvas with no connections", () => {
    const hints = diagramHints(diagramWith([block("a", "Web", "x"), block("b", "API", "x")]));
    expect(hints).toEqual([]);
  });

  it("checks internal designs, without asking for owners there", () => {
    const parent = block("p", "Orders", "Team A");
    if (parent.data.kind === "block") {
      parent.data.detail = { nodes: [block("x", "Queue"), block("y", "Worker")], edges: [{ id: "i", source: "x", target: "y" }] };
    }
    const hints = diagramHints(diagramWith([parent]));
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ kind: "no-protocol", detailId: "p", where: "Section 1 › Orders" });
  });
});
