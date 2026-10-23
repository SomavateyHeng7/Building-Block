import { beforeEach, describe, expect, it } from "vitest";
import { CONTAINER_HEADER, CONTAINER_MIN, CONTAINER_PADDING, absolutePosition, groupIntoContainer } from "@/lib/diagram/layout";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { requestDelete, resolveDelete, ungroup, useDeletePrompt } from "@/components/editor/deletePrompt";
import { currentToasts } from "@/lib/toast";
import type { DiagramNode } from "@/lib/diagram/types";

const store = () => useDiagramStore.getState();
const active = () => getActiveSection(store().diagram);
const find = (id: string) => active().nodes.find((node) => node.id === id)!;
const onScreen = (id: string) => absolutePosition(find(id), active().nodes);

function block(id: string, x: number, y: number, parentId?: string): DiagramNode {
  return {
    id,
    type: "block",
    position: { x, y },
    size: { width: 100, height: 50 },
    parentId,
    data: { kind: "block", label: id, containerId: parentId ?? null },
  };
}

function addBlock(x: number, y: number, parentId: string | null = null) {
  store().addBlock({ x, y }, parentId);
  return store().selectedNodeIds[0];
}

function addContainer(x: number, y: number) {
  store().addContainer({ x, y });
  return store().selectedNodeIds[0];
}

describe("groupIntoContainer", () => {
  it("draws the container around the components, so nothing moves on screen", () => {
    const nodes = [block("a", 100, 100), block("b", 400, 300)];
    const grouped = groupIntoContainer(nodes, ["a", "b"], { id: "g", label: "Group" });
    const container = grouped.at(-1)!;
    expect(container).toMatchObject({ id: "g", type: "container", position: { x: 100 - CONTAINER_PADDING, y: 100 - CONTAINER_HEADER } });
    expect(container.size).toEqual({ width: 400 + CONTAINER_PADDING * 2, height: 250 + CONTAINER_HEADER + CONTAINER_PADDING });
    for (const id of ["a", "b"]) {
      const node = grouped.find((candidate) => candidate.id === id)!;
      expect(node.parentId).toBe("g");
      expect(node.data.kind === "block" && node.data.containerId).toBe("g");
      expect(absolutePosition(node, grouped)).toEqual(nodes.find((candidate) => candidate.id === id)!.position);
    }
  });

  it("is never smaller than the smallest container", () => {
    const grouped = groupIntoContainer([block("a", 0, 0)], ["a"], { id: "g", label: "Group" });
    expect(grouped.at(-1)!.size).toEqual({ width: CONTAINER_MIN.width, height: CONTAINER_MIN.height });
  });

  it("ignores containers and returns the same nodes with no component to group", () => {
    const nodes = groupIntoContainer([block("a", 0, 0)], ["a"], { id: "c", label: "C" });
    expect(groupIntoContainer(nodes, ["c"], { id: "g", label: "G" })).toBe(nodes);
  });
});

describe("grouping in the editor", () => {
  beforeEach(() => store().loadDiagram(createBlankDiagram()));

  it("groups components from inside and outside containers, as one undo step", () => {
    const old = addContainer(0, 0);
    const inside = addBlock(16, 40, old);
    const outside = addBlock(600, 400);
    const before = [onScreen(inside), onScreen(outside)];
    const id = store().groupNodes([inside, outside, old])!;
    expect(store().selectedNodeIds).toEqual([id]);
    expect(find(inside).parentId).toBe(id);
    expect(find(outside).parentId).toBe(id);
    expect([onScreen(inside), onScreen(outside)]).toEqual(before);
    expect(find(old)).toBeDefined();
    store().undo();
    expect(find(inside).parentId).toBe(old);
    expect(active().nodes.some((node) => node.id === id)).toBe(false);
  });

  it("ungroups a container, or the one holding a selected component, keeping the components", () => {
    const container = addContainer(200, 100);
    const a = addBlock(16, 40, container);
    const b = addBlock(16, 120, container);
    const before = onScreen(b);
    store().ungroupNodes([a]);
    expect(active().nodes.map((node) => node.id)).toEqual([a, b]);
    expect(find(b).parentId).toBeUndefined();
    expect(onScreen(b)).toEqual(before);
    expect(store().selectedNodeIds).toEqual([a, b]);
  });
});

describe("deleting a container that holds components", () => {
  let container: string;
  let a: string;
  let b: string;

  beforeEach(() => {
    store().loadDiagram(createBlankDiagram());
    container = addContainer(0, 0);
    a = addBlock(16, 40, container);
    b = addBlock(16, 120, container);
    resolveDelete("cancel");
  });

  it("asks first, even when its components were selected with it, and cancelling changes nothing", () => {
    requestDelete([container, a, b]);
    expect(useDeletePrompt.getState().pending).toMatchObject({ containers: ["New Container"], contents: 2 });
    resolveDelete("cancel");
    expect(active().nodes).toHaveLength(3);
  });

  it("keeps the components, including selected ones, when asked to", () => {
    requestDelete([container, a]);
    resolveDelete("keep");
    expect(active().nodes.map((node) => node.id)).toEqual([a, b]);
  });

  it("deletes everything when asked to", () => {
    requestDelete([container]);
    resolveDelete("all");
    expect(active().nodes).toEqual([]);
  });

  it("doesn't ask for an empty container or a lone component", () => {
    const empty = addContainer(800, 0);
    requestDelete([empty, a]);
    expect(useDeletePrompt.getState().pending).toBeNull();
    expect(active().nodes.map((node) => node.id)).toEqual([container, b]);
  });
});

describe("connections when deleting and ungrouping", () => {
  beforeEach(() => store().loadDiagram(createBlankDiagram()));

  it("deletes boxes and selected connections as one undo step", () => {
    const a = addBlock(0, 0);
    const b = addBlock(300, 0);
    const c = addBlock(600, 0);
    store().addConnection({ source: a, target: b });
    const bc = store().addConnection({ source: b, target: c })!;
    const steps = store().past.length;
    requestDelete([a], [bc]);
    expect(active().nodes.map((node) => node.id)).toEqual([b, c]);
    expect(active().edges).toEqual([]);
    expect(store().past.length).toBe(steps + 1);
    store().undo();
    expect(active().edges).toHaveLength(2);
  });

  it("says when ungrouping removed connections to the container", () => {
    const container = addContainer(0, 0);
    const inside = addBlock(16, 40, container);
    const outside = addBlock(600, 0);
    store().addConnection({ source: outside, target: container });
    store().addConnection({ source: outside, target: inside });
    ungroup([container]);
    expect(active().edges).toHaveLength(1);
    expect(currentToasts().at(-1)?.title).toBe("Removed 1 connection to the container");
  });
});
