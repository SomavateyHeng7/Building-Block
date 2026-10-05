import { describe, expect, it } from "vitest";
import {
  CONTAINER_HEADER,
  CONTAINER_PADDING,
  LAYOUT_GAP,
  arrangeNodes,
  growContainerToFit,
  nextSlotInContainer,
  nudgeNodes,
} from "./layout";
import type { DiagramNode } from "./types";

function block(id: string, x: number, y: number, parentId?: string, width = 100, height = 40): DiagramNode {
  return {
    id,
    type: "block",
    position: { x, y },
    size: { width, height },
    parentId,
    data: { kind: "block", label: id, containerId: parentId ?? null },
  };
}

function container(id: string, x: number, y: number, width = 300, height = 200): DiagramNode {
  return {
    id,
    type: "container",
    position: { x, y },
    size: { width, height },
    data: { kind: "container", label: id },
  };
}

const byId = (nodes: DiagramNode[], id: string) => nodes.find((n) => n.id === id)!;

describe("arrangeNodes", () => {
  it("does nothing with fewer than two nodes", () => {
    const nodes = [block("a", 0, 0)];
    expect(arrangeNodes(nodes, ["a"], "align-left")).toBe(nodes);
  });

  it("aligns to the left-most edge", () => {
    const result = arrangeNodes([block("a", 10, 0), block("b", 50, 80)], ["a", "b"], "align-left");
    expect(byId(result, "b").position.x).toBe(10);
  });

  it("matches widths to the widest node", () => {
    const result = arrangeNodes([block("a", 0, 0, undefined, 80), block("b", 0, 60, undefined, 200)], ["a", "b"], "same-width");
    expect(byId(result, "a").size.width).toBe(200);
  });

  it("distributes three nodes with equal gaps", () => {
    const nodes = [block("a", 0, 0), block("b", 30, 0), block("c", 400, 0)];
    const result = arrangeNodes(nodes, ["a", "b", "c"], "distribute-horizontal");
    const gap1 = byId(result, "b").position.x - (byId(result, "a").position.x + 100);
    const gap2 = byId(result, "c").position.x - (byId(result, "b").position.x + 100);
    expect(gap1).toBeCloseTo(gap2);
  });

  it("works in canvas coordinates for nested nodes", () => {
    const nodes = [container("c", 100, 100), block("in", 20, 50, "c"), block("out", 0, 0)];
    const result = arrangeNodes(nodes, ["in", "out"], "align-left");
    // "in" sits at canvas x=120 and "out" at 0, so both align to canvas x=0.
    expect(byId(result, "out").position.x).toBe(0);
    // "in" is positioned relative to its container at x=100.
    expect(byId(result, "in").position.x).toBe(-100);
  });
});

describe("growContainerToFit", () => {
  it("grows a container to hold a child that overflows", () => {
    const nodes = [container("c", 0, 0, 200, 120), block("b", 150, 100, "c")];
    const grown = byId(growContainerToFit(nodes, "c"), "c");
    expect(grown.size.width).toBe(150 + 100 + CONTAINER_PADDING);
    expect(grown.size.height).toBe(100 + 40 + CONTAINER_PADDING);
  });

  it("never shrinks a container", () => {
    const nodes = [container("c", 0, 0, 500, 400), block("b", 16, 40, "c")];
    expect(growContainerToFit(nodes, "c")).toEqual(nodes);
  });
});

describe("nextSlotInContainer", () => {
  it("starts below the header when the container is empty", () => {
    expect(nextSlotInContainer([container("c", 0, 0)], "c")).toEqual({ x: CONTAINER_PADDING, y: CONTAINER_HEADER });
  });

  it("goes below the lowest child", () => {
    const nodes = [container("c", 0, 0), block("a", 16, 40, "c"), block("b", 16, 100, "c")];
    expect(nextSlotInContainer(nodes, "c")).toEqual({ x: CONTAINER_PADDING, y: 100 + 40 + LAYOUT_GAP });
  });
});

describe("nudgeNodes", () => {
  it("moves a free node", () => {
    const result = nudgeNodes([block("a", 10, 10)], ["a"], 8, -8);
    expect(result[0].position).toEqual({ x: 18, y: 2 });
  });

  it("moves only the container when both container and child are selected", () => {
    const nodes = [container("c", 0, 0), block("b", 20, 50, "c")];
    const result = nudgeNodes(nodes, ["c", "b"], 8, 8);
    expect(byId(result, "c").position).toEqual({ x: 8, y: 8 });
    expect(byId(result, "b").position).toEqual({ x: 20, y: 50 });
  });

  it("keeps a child out of its container's header and padding", () => {
    const nodes = [container("c", 0, 0), block("b", CONTAINER_PADDING, CONTAINER_HEADER, "c")];
    const result = nudgeNodes(nodes, ["b"], -32, -32);
    expect(byId(result, "b").position).toEqual({ x: CONTAINER_PADDING, y: CONTAINER_HEADER });
  });

  it("grows the container when a child is pushed past its edge", () => {
    const nodes = [container("c", 0, 0, 200, 120), block("b", 80, 40, "c")];
    const result = nudgeNodes(nodes, ["b"], 32, 0);
    expect(byId(result, "c").size.width).toBe(112 + 100 + CONTAINER_PADDING);
  });
});
