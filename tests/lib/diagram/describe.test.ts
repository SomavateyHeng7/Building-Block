import { describe, expect, it } from "vitest";
import { announceChange, describeEdge, describeNode, describeView, type Watched } from "@/lib/diagram/describe";
import { createBlankDiagram } from "@/lib/diagram/factory";
import type { Diagram, DiagramNode } from "@/lib/diagram/types";

const block = (id: string, label: string, data: Record<string, unknown> = {}, parentId?: string): DiagramNode =>
  ({
    id,
    type: "block",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 50 },
    ...(parentId ? { parentId } : {}),
    data: { kind: "block", label, containerId: parentId ?? null, ...data },
  }) as DiagramNode;

function sample(): Diagram {
  const diagram = createBlankDiagram("Shop");
  diagram.sections[0] = {
    ...diagram.sections[0],
    name: "Current",
    nodes: [
      { id: "c", type: "container", position: { x: 0, y: 0 }, size: { width: 300, height: 200 }, data: { kind: "container", label: "Back office" } },
      block("a", "Web"),
      block("b", "Orders", { technology: "Java", owner: "Team B", colorKey: diagram.legend[0].key }, "c"),
    ],
    edges: [{ id: "e", source: "a", target: "b", label: "Place order", protocol: "REST", style: "dashed" }],
  };
  diagram.comments = [{ id: "k", targetId: "b", author: "Sam", text: "?", createdAt: "2026-10-30T10:00:00Z" }];
  return diagram;
}

const watch = (diagram: Diagram, selectedNodeIds: string[] = [], selectedEdgeId: string | null = null): Watched => ({ diagram, selectedNodeIds, selectedEdgeId });

describe("describing things", () => {
  const diagram = sample();
  const { nodes, edges = [] } = diagram.sections[0];

  it("says what a component is, where it sits and what it connects to", () => {
    expect(describeNode(diagram, nodes[2], nodes, edges)).toBe(
      `Orders, component in Back office. Category: ${diagram.legend[0].label}. Technology: Java. Owner: Team B. 1 connection. 1 open comment.`,
    );
    expect(describeNode(diagram, nodes[1], nodes, edges)).toBe("Web, component. 1 connection.");
    expect(describeNode(diagram, nodes[0], nodes, edges)).toBe("Back office, container.");
  });

  it("says what a connection joins and carries", () => {
    expect(describeEdge(diagram, edges[0], nodes)).toBe("Connection from Web to Orders. What flows: Place order. Protocol: REST. Dashed.");
    expect(describeEdge(diagram, { ...edges[0], direction: "both", label: undefined, protocol: undefined, style: undefined }, nodes)).toBe(
      "Connection between Web and Orders.",
    );
  });

  it("says where you are", () => {
    expect(describeView(diagram)).toBe("Current. 2 components, 1 connection.");
  });
});

describe("announceChange", () => {
  const before = watch(sample());

  it("says nothing when only a box moved", () => {
    const moved = sample();
    moved.sections = before.diagram.sections.map((section) => ({ ...section, nodes: section.nodes.map((node) => ({ ...node, position: { x: 50, y: 50 } })) }));
    expect(announceChange(before, watch({ ...before.diagram, sections: moved.sections }))).toBeNull();
  });

  it("describes a single selection, several, and clearing", () => {
    expect(announceChange(before, watch(before.diagram, ["a"]))).toBe("Web, component. 1 connection.");
    expect(announceChange(before, watch(before.diagram, ["a", "b"]))).toBe("2 items selected.");
    expect(announceChange(watch(before.diagram, ["a"]), watch(before.diagram, []))).toBe("Selection cleared.");
    expect(announceChange(before, watch(before.diagram, [], "e"))).toMatch(/^Connection from Web to Orders/);
  });

  it("announces additions and removals with the new count", () => {
    const sections = [{ ...before.diagram.sections[0], nodes: [...before.diagram.sections[0].nodes, block("n", "Billing")] }];
    expect(announceChange(before, watch({ ...before.diagram, sections }))).toBe("Added Billing. 4 items here.");
    const fewer = [{ ...before.diagram.sections[0], nodes: before.diagram.sections[0].nodes.filter((node) => node.id !== "a") }];
    expect(announceChange(before, watch({ ...before.diagram, sections: fewer }))).toBe("Removed Web. 2 items left.");
    const noEdges = [{ ...before.diagram.sections[0], edges: [] }];
    expect(announceChange(before, watch({ ...before.diagram, sections: noEdges }))).toBe("Removed 1 connection.");
  });

  it("says where you arrived when the view changes", () => {
    const other = { ...before.diagram, sections: [...before.diagram.sections, { ...before.diagram.sections[0], id: "s2", name: "Target", nodes: [], edges: [] }], activeSectionId: "s2" };
    expect(announceChange(before, watch(other))).toBe("Target. 0 components, 0 connections.");
  });
});
