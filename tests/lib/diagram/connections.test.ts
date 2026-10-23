import { beforeEach, describe, expect, it } from "vitest";
import { suggestConnectionSides } from "@/lib/diagram/layout";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { parseDiagram } from "@/lib/diagram/validate";
import { createBlankDiagram, defaultLabel } from "@/lib/diagram/factory";
import { historyKey } from "@/lib/diagram/flowAdapter";
import { l0ArchitectureTemplate } from "@/templates/l0-architecture";
import type { DiagramNode } from "@/lib/diagram/types";

const store = () => useDiagramStore.getState();
const active = () => getActiveSection(store().diagram);

/** Adds a component at a spot and returns its id. */
function addBlock(x: number, y: number, parentId: string | null = null) {
  store().addBlock({ x, y }, parentId);
  return store().selectedNodeIds[0];
}

function block(id: string, x = 0, y = 0): DiagramNode {
  return {
    id,
    type: "block",
    position: { x, y },
    size: { width: 100, height: 50 },
    data: { kind: "block", label: id, containerId: null },
  };
}

function fileWith(nodes: DiagramNode[], edges: unknown) {
  const diagram = createBlankDiagram();
  return {
    ...diagram,
    sections: [{ id: "s1", name: "One", nodes, ...(edges === undefined ? {} : { edges }) }],
    activeSectionId: "s1",
  };
}

describe("reading connections from a file", () => {
  it("accepts files from before connections existed", () => {
    const { diagram, fixes } = parseDiagram(fileWith([block("a"), block("b")], undefined));
    expect(diagram.sections[0].edges).toBeUndefined();
    expect(fixes).toEqual([]);
  });

  it("keeps valid connections and their details", () => {
    const edge = {
      id: "e1",
      source: "a",
      target: "b",
      sourceSide: "right",
      targetSide: "left",
      label: " Orders ",
      protocol: "REST",
      direction: "both",
      style: "dashed",
    };
    const { diagram, fixes } = parseDiagram(fileWith([block("a"), block("b")], [edge]));
    expect(diagram.sections[0].edges).toEqual([{ ...edge, label: "Orders" }]);
    expect(fixes).toEqual([]);
  });

  it("drops connections that don't join two different boxes, and says so", () => {
    const container = { ...block("box"), type: "container", data: { kind: "container", label: "Box" } };
    const edges = [
      { id: "ok", source: "a", target: "b" },
      { id: "self", source: "a", target: "a" },
      { id: "ghost", source: "a", target: "missing" },
      { id: "box", source: "a", target: "box" },
      { id: "ok", source: "b", target: "a" },
      { source: "a", target: "b" },
      "nonsense",
    ];
    const { diagram, fixes } = parseDiagram(fileWith([block("a"), block("b"), container as DiagramNode], edges));
    expect(diagram.sections[0].edges?.map((edge) => edge.id)).toEqual(["ok", "box"]);
    expect(fixes).toContain('"One": skipped 5 connections that didn\'t join two different boxes.');
  });

  it("ignores unknown values for sides, direction and line style", () => {
    const edges = [{ id: "e", source: "a", target: "b", sourceSide: "middle", direction: "up", style: "wavy" }];
    const { diagram } = parseDiagram(fileWith([block("a"), block("b")], edges));
    expect(diagram.sections[0].edges).toEqual([{ id: "e", source: "a", target: "b" }]);
  });
});

describe("connections in the editor", () => {
  let a: string;
  let b: string;
  let c: string;

  beforeEach(() => {
    store().loadDiagram(createBlankDiagram());
    a = addBlock(0, 0);
    b = addBlock(300, 0);
    c = addBlock(300, 200);
  });

  it("joins two components and selects the connection", () => {
    const id = store().addConnection({ source: a, target: b, sourceSide: "right", targetSide: "left" });
    expect(id).not.toBeNull();
    expect(active().edges).toEqual([{ id, source: a, target: b, sourceSide: "right", targetSide: "left" }]);
    expect(store().selectedEdgeId).toBe(id);
    expect(store().selectedNodeIds).toEqual([]);
  });

  it("joins a component to a container", () => {
    store().addContainer({ x: 0, y: 400 });
    const container = store().selectedNodeIds[0];
    const id = store().addConnection({ source: a, target: container, sourceSide: "bottom", targetSide: "top" });
    expect(id).not.toBeNull();
    expect(active().edges).toEqual([{ id, source: a, target: container, sourceSide: "bottom", targetSide: "top" }]);
  });

  it("drops a container's connections when the container is deleted, keeping its components'", () => {
    store().addContainer({ x: 0, y: 400 });
    const container = store().selectedNodeIds[0];
    store().addConnection({ source: a, target: container });
    const kept = store().addConnection({ source: a, target: b });
    store().deleteNodes([container]);
    expect(active().edges?.map((edge) => edge.id)).toEqual([kept]);
  });

  it("moves an end of a connection to another box and side, dropping its bend", () => {
    const id = store().addConnection({ source: a, target: b, sourceSide: "right", targetSide: "left" })!;
    store().updateConnection(id, { bend: { x: 16, y: 8 }, label: "Orders" });
    expect(store().reconnectConnection(id, { source: a, target: c, sourceSide: "bottom", targetSide: "top" })).toBe(true);
    expect(active().edges).toEqual([{ id, source: a, target: c, sourceSide: "bottom", targetSide: "top", label: "Orders" }]);
    store().undo();
    expect(active().edges![0]).toMatchObject({ target: b, bend: { x: 16, y: 8 } });
  });

  it("refuses to move an end onto its own box or a missing one", () => {
    const id = store().addConnection({ source: a, target: b })!;
    expect(store().reconnectConnection(id, { source: a, target: a })).toBe(false);
    expect(store().reconnectConnection(id, { source: a, target: "nope" })).toBe(false);
    expect(store().reconnectConnection("nope", { source: a, target: c })).toBe(false);
    expect(active().edges![0]).toMatchObject({ source: a, target: b });
  });

  it("refuses self-connections, unknown ids and exact duplicates", () => {
    expect(store().addConnection({ source: a, target: a })).toBeNull();
    expect(store().addConnection({ source: a, target: "nope" })).toBeNull();
    expect(store().addConnection({ source: a, target: b })).not.toBeNull();
    expect(store().addConnection({ source: a, target: b })).toBeNull();
    // The other way round, or from a different side, is a different connection.
    expect(store().addConnection({ source: b, target: a })).not.toBeNull();
    expect(active().edges).toHaveLength(2);
  });

  it("undoes and redoes adding a connection", () => {
    store().addConnection({ source: a, target: b });
    store().undo();
    expect(active().edges ?? []).toHaveLength(0);
    expect(store().selectedEdgeId).toBeNull();
    store().redo();
    expect(active().edges).toHaveLength(1);
  });

  it("edits details, treating blank text as cleared", () => {
    const id = store().addConnection({ source: a, target: b })!;
    store().updateConnection(id, { label: "Orders", protocol: "REST", direction: "both", style: "dashed" });
    expect(active().edges![0]).toMatchObject({ label: "Orders", protocol: "REST", direction: "both", style: "dashed" });
    store().updateConnection(id, { label: "   " });
    expect(active().edges![0].label).toBeUndefined();
  });

  it("reverses a connection, swapping its sides too", () => {
    const id = store().addConnection({ source: a, target: b, sourceSide: "right", targetSide: "left" })!;
    store().reverseConnection(id);
    expect(active().edges![0]).toMatchObject({ source: b, target: a, sourceSide: "left", targetSide: "right" });
  });

  it("deletes a connection and clears its selection", () => {
    const id = store().addConnection({ source: a, target: b })!;
    store().deleteConnections([id]);
    expect(active().edges ?? []).toHaveLength(0);
    expect(store().selectedEdgeId).toBeNull();
  });

  it("removes connections together with a deleted component, and undo brings both back", () => {
    store().addConnection({ source: a, target: b });
    store().addConnection({ source: c, target: b });
    store().addConnection({ source: a, target: c });
    store().deleteNodes([b]);
    expect(active().edges?.map((edge) => [edge.source, edge.target])).toEqual([[a, c]]);
    store().undo();
    expect(active().edges).toHaveLength(3);
    expect(active().nodes.some((node) => node.id === b)).toBe(true);
  });

  it("removes connections when React Flow replaces the nodes without a component", () => {
    store().addConnection({ source: a, target: b });
    store().setActiveSectionNodes(active().nodes.filter((node) => node.id !== a));
    expect(active().edges ?? []).toHaveLength(0);
  });

  it("duplicates connections only when both ends are duplicated", () => {
    store().addConnection({ source: a, target: b });
    store().addConnection({ source: a, target: c });
    store().setSelection([a, b]);
    store().duplicateSelection();
    const [copyA, copyB] = store().selectedNodeIds;
    const edges = active().edges!;
    expect(edges).toHaveLength(3);
    expect(edges.filter((edge) => edge.source === copyA && edge.target === copyB)).toHaveLength(1);
    expect(edges.every((edge) => active().nodes.some((node) => node.id === edge.source))).toBe(true);
  });

  it("copies connections along with a duplicated tab", () => {
    store().addConnection({ source: a, target: b });
    store().duplicateSection(store().diagram.activeSectionId);
    const [original, copy] = store().diagram.sections;
    expect(copy.edges).toHaveLength(1);
    const ids = new Set(copy.nodes.map((node) => node.id));
    expect(ids.has(copy.edges![0].source) && ids.has(copy.edges![0].target)).toBe(true);
    expect(copy.edges![0].id).not.toBe(original.edges![0].id);
    expect(copy.edges![0].source).not.toBe(a);
  });

  it("round-trips through a saved file", () => {
    store().addConnection({ source: a, target: b, sourceSide: "right", targetSide: "left" });
    store().updateConnection(active().edges![0].id, { protocol: "gRPC", style: "dashed" });
    const reloaded = parseDiagram(JSON.parse(JSON.stringify(store().diagram)));
    expect(reloaded.fixes).toEqual([]);
    expect(reloaded.diagram.sections[0].edges).toEqual(active().edges);
  });
});

describe("choosing sides", () => {
  const nodes = [block("left", 0, 0), block("right", 400, 0), block("below", 0, 300), block("above", 0, -300)];

  it("faces the two components toward each other", () => {
    expect(suggestConnectionSides(nodes, "left", "right")).toEqual({ sourceSide: "right", targetSide: "left" });
    expect(suggestConnectionSides(nodes, "right", "left")).toEqual({ sourceSide: "left", targetSide: "right" });
    expect(suggestConnectionSides(nodes, "left", "below")).toEqual({ sourceSide: "bottom", targetSide: "top" });
    expect(suggestConnectionSides(nodes, "left", "above")).toEqual({ sourceSide: "top", targetSide: "bottom" });
  });
});

describe("L0 template", () => {
  it("has example connections that point at real components", () => {
    const diagram = l0ArchitectureTemplate.build();
    const section = diagram.sections[0];
    expect(section.edges?.length).toBeGreaterThan(0);
    expect(parseDiagram(JSON.parse(JSON.stringify(diagram))).fixes).toEqual([]);
  });
});

describe("paste and duplicate inside a container", () => {
  beforeEach(() => store().loadDiagram(createBlankDiagram()));

  function fitsInside(containerId: string) {
    const container = active().nodes.find((node) => node.id === containerId)!;
    return active()
      .nodes.filter((node) => node.parentId === containerId)
      .every(
        (node) =>
          node.position.x + node.size.width <= container.size.width &&
          node.position.y + node.size.height <= container.size.height,
      );
  }

  it("grows the container so repeated pastes stay inside it", () => {
    store().addContainer({ x: 0, y: 0 });
    const containerId = store().selectedNodeIds[0];
    store().setSelection([addBlock(16, 40, containerId)]);
    store().copySelection();
    for (let i = 0; i < 10; i++) store().paste();
    expect(active().nodes.filter((node) => node.parentId === containerId)).toHaveLength(11);
    expect(fitsInside(containerId)).toBe(true);
  });

  it("grows the container for duplicates too", () => {
    store().addContainer({ x: 0, y: 0 });
    const containerId = store().selectedNodeIds[0];
    store().setSelection([addBlock(200, 160, containerId)]);
    for (let i = 0; i < 5; i++) store().duplicateSelection();
    expect(fitsInside(containerId)).toBe(true);
  });
});

describe("no-op renames", () => {
  beforeEach(() => store().loadDiagram(createBlankDiagram()));

  it("doesn't record an undo step for renaming a tab or component to its current name", () => {
    const section = store().diagram.sections[0];
    store().renameSection(section.id, section.name);
    const id = addBlock(0, 0);
    const steps = store().past.length;
    store().updateNodeLabel(id, "New Block");
    expect(store().past.length).toBe(steps);
    expect(store().past.length).toBe(1);
  });
});

describe("historyKey", () => {
  it("gives the same undo key whatever order the dragged ids come in", () => {
    expect(historyKey("move", ["b", "a", "c"])).toBe(historyKey("move", ["c", "b", "a"]));
    expect(historyKey("move", ["a"])).not.toBe(historyKey("resize", ["a"]));
  });

  it("makes a multi-drag and the re-parent at its end a single undo step", () => {
    store().loadDiagram(createBlankDiagram());
    const a = addBlock(0, 0);
    const b = addBlock(200, 0);
    const before = store().past.length;
    const moved = active().nodes.map((node) => ({ ...node, position: { x: node.position.x + 8, y: 0 } }));
    store().setActiveSectionNodes(moved, { coalesceKey: historyKey("move", [a, b]) });
    store().setActiveSectionNodes(moved, { coalesceKey: historyKey("move", [b, a]) });
    expect(store().past.length).toBe(before + 1);
  });
});

describe("defaultLabel", () => {
  it("names blank components and containers", () => {
    expect(defaultLabel("block")).toBe("Untitled");
    expect(defaultLabel("container")).toBe("Untitled Container");
  });
});
