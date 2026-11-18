import { beforeEach, describe, expect, it } from "vitest";
import { autoSideEdges, withAutoSides } from "@/lib/diagram/layout/autoSides";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { parseDiagram } from "@/lib/diagram/validate";
import type { DiagramEdge, DiagramNode } from "@/lib/diagram/types";

const store = () => useDiagramStore.getState();
const active = () => getActiveSection(store().diagram);
const edgeOf = (id: string) => active().edges!.find((edge) => edge.id === id)!;

function block(id: string, x: number, y: number, parentId?: string): DiagramNode {
  return {
    id,
    type: "block",
    position: { x, y },
    size: { width: 100, height: 50 },
    ...(parentId ? { parentId } : {}),
    data: { kind: "block", label: id, containerId: parentId ?? null },
  };
}

function addBlock(x: number, y: number) {
  store().addBlock({ x, y });
  return store().selectedNodeIds[0];
}

function move(id: string, x: number, y: number) {
  store().setActiveSectionNodes(active().nodes.map((node) => (node.id === id ? { ...node, position: { x, y } } : node)));
}

describe("autoSideEdges", () => {
  const nodes = [block("a", 0, 0), block("b", 400, 0), block("c", 0, 400)];

  it("turns automatic connections to the sides that face each other", () => {
    const edges: DiagramEdge[] = [
      { id: "1", source: "a", target: "b", sourceSide: "bottom", targetSide: "top", autoSides: true },
      { id: "2", source: "a", target: "c", sourceSide: "right", targetSide: "left", autoSides: true, bend: { x: 5, y: 0 } },
    ];
    const out = autoSideEdges(nodes, edges);
    expect(out[0]).toMatchObject({ sourceSide: "right", targetSide: "left" });
    expect(out[1]).toMatchObject({ sourceSide: "bottom", targetSide: "top", bend: { x: 5, y: 0 } });
  });

  it("leaves fixed connections alone and returns the same array when nothing changes", () => {
    const edges: DiagramEdge[] = [
      { id: "1", source: "a", target: "b", sourceSide: "bottom", targetSide: "top" },
      { id: "2", source: "a", target: "c", sourceSide: "bottom", targetSide: "top", autoSides: true },
    ];
    expect(autoSideEdges(nodes, edges)).toBe(edges);
  });

  it("works in canvas coordinates for nested components", () => {
    const container: DiagramNode = { id: "k", type: "container", position: { x: 0, y: 300 }, size: { width: 600, height: 300 }, data: { kind: "container", label: "K" } };
    const edges: DiagramEdge[] = [{ id: "1", source: "a", target: "n", sourceSide: "right", targetSide: "left", autoSides: true }];
    const out = autoSideEdges([block("a", 0, 0), container, block("n", 16, 40, "k")], edges);
    expect(out[0]).toMatchObject({ sourceSide: "bottom", targetSide: "top" });
  });

  it("follows the components inside an internal design too", () => {
    const diagram = createBlankDiagram();
    const host: DiagramNode = {
      ...block("h", 0, 0),
      data: {
        kind: "block",
        label: "h",
        containerId: null,
        detail: { nodes: [block("a", 0, 0), block("b", 0, 400)], edges: [{ id: "1", source: "a", target: "b", sourceSide: "right", targetSide: "left", autoSides: true }] },
      },
    };
    const input = { ...diagram, sections: [{ ...diagram.sections[0], nodes: [host] }] };
    const out = withAutoSides(input);
    const detail = out.sections[0].nodes[0].data.kind === "block" ? out.sections[0].nodes[0].data.detail : undefined;
    expect(detail?.edges?.[0]).toMatchObject({ sourceSide: "bottom", targetSide: "top" });
    expect(withAutoSides(out)).toBe(out);
  });
});

describe("connections that follow their components", () => {
  beforeEach(() => store().loadDiagram(createBlankDiagram()));

  it("follows when drawn on the facing sides, and turns as a component moves", () => {
    const a = addBlock(0, 0);
    const b = addBlock(400, 0);
    const id = store().addConnection({ source: a, target: b, sourceSide: "right", targetSide: "left" })!;
    expect(edgeOf(id).autoSides).toBe(true);
    move(b, 0, 400);
    expect(edgeOf(id)).toMatchObject({ sourceSide: "bottom", targetSide: "top" });
  });

  it("stays put when drawn to other sides on purpose", () => {
    const a = addBlock(0, 0);
    const b = addBlock(400, 0);
    const id = store().addConnection({ source: a, target: b, sourceSide: "top", targetSide: "top" })!;
    expect(edgeOf(id).autoSides).toBeUndefined();
    move(b, 0, 400);
    expect(edgeOf(id)).toMatchObject({ sourceSide: "top", targetSide: "top" });
  });

  it("pins or frees an end moved onto a side", () => {
    const a = addBlock(0, 0);
    const b = addBlock(400, 0);
    const id = store().addConnection({ source: a, target: b, sourceSide: "right", targetSide: "left" })!;
    store().reconnectConnection(id, { source: a, target: b, sourceSide: "bottom", targetSide: "left" });
    expect(edgeOf(id).autoSides).toBeUndefined();
    store().reconnectConnection(id, { source: a, target: b, sourceSide: "right", targetSide: "left" });
    expect(edgeOf(id).autoSides).toBe(true);
  });

  it("is saved and read back from a file", () => {
    const a = addBlock(0, 0);
    const b = addBlock(400, 0);
    const id = store().addConnection({ source: a, target: b })!;
    const { diagram } = parseDiagram(JSON.parse(JSON.stringify(store().diagram)));
    expect(getActiveSection(diagram).edges!.find((edge) => edge.id === id)).toMatchObject({ autoSides: true, sourceSide: "right", targetSide: "left" });
  });
});

describe("quick add", () => {
  beforeEach(() => store().loadDiagram(createBlankDiagram()));

  it("adds a connected component that follows, off the arrow's side", () => {
    const a = addBlock(0, 0);
    store().addConnectedBlock(a, "right");
    const added = store().selectedNodeIds[0];
    const edge = active().edges!.find((candidate) => candidate.target === added)!;
    expect(edge).toMatchObject({ source: a, sourceSide: "right", targetSide: "left", autoSides: true });
    const node = active().nodes.find((candidate) => candidate.id === added)!;
    expect(node.position.x).toBeGreaterThan(100);
    // Named like any new component, not a flowchart step.
    expect(node.data.label).toBe("New Block");
  });

  it("puts the new component where the arrow was dropped, inside the container there", () => {
    const a = addBlock(0, 0);
    store().addContainer({ x: 500, y: 500 });
    const container = store().selectedNodeIds[0];
    store().addConnectedBlock(a, "right", undefined, { x: 600, y: 600 });
    const added = active().nodes.find((node) => node.id === store().selectedNodeIds[0])!;
    expect(added.parentId).toBe(container);
    expect(added.position).toEqual({ x: 600 - 500 - added.size.width / 2, y: 600 - 500 - added.size.height / 2 });
    const edge = active().edges!.find((candidate) => candidate.target === added.id)!;
    expect(edge).toMatchObject({ sourceSide: "bottom", targetSide: "top" });
  });
});
