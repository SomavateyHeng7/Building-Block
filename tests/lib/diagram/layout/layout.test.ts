import { describe, expect, it } from "vitest";
import {
  CONTAINER_HEADER,
  CONTAINER_PADDING,
  LAYOUT_GAP,
  absolutePosition,
  arrangeNodes,
  contentExtents,
  dropIntoContainers,
  growContainerToFit,
  nextSlotInContainer,
  nudgeNodes,
  parentsFirst,
  tidyContainer,
} from "@/lib/diagram/layout/layout";
import { tidyLayout } from "@/lib/diagram/layout/autoLayout";
import type { DiagramNode } from "@/lib/diagram/types";

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
    const nodes = [container("c", 100, 100, 300, 300), block("in", 20, 50, "c"), block("out", 50, 0)];
    const result = arrangeNodes(nodes, ["in", "out"], "align-left");
    // "in" sits at canvas x=120 and "out" at 50, so both align to canvas x=50: still over the container.
    expect(byId(result, "out").position.x).toBe(50);
    expect(byId(result, "in").parentId).toBe("c");
    // Relative to the container, but kept clear of its padding.
    expect(byId(result, "in").position.x).toBe(CONTAINER_PADDING);
  });

  it("takes a component out of its container when aligning moves it outside", () => {
    const nodes = [container("c", 300, 100), block("in", 16, 40, "c"), block("out", 0, 500)];
    const moved = byId(arrangeNodes(nodes, ["in", "out"], "align-left"), "in");
    expect(moved.parentId).toBeUndefined();
    expect(moved.data.containerId).toBeNull();
    expect(moved.position).toEqual({ x: 0, y: 140 });
  });

  it("moves a selected container's children with it, not twice", () => {
    const nodes = [container("c", 100, 100), block("in", 50, 50, "c"), block("out", 0, 500)];
    const result = arrangeNodes(nodes, ["c", "in", "out"], "align-left");
    expect(byId(result, "c").position.x).toBe(0);
    expect(byId(result, "in")).toEqual(nodes[1]);
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

describe("dropIntoContainers", () => {
  it("takes a component out of its container when dropped outside it", () => {
    const nodes = [container("c", 100, 100), block("a", 20, 50, "c")];
    // Dragged to canvas (500, 500): relative to the container that's (400, 400).
    const a = byId(dropIntoContainers(nodes, [{ id: "a", position: { x: 400, y: 400 } }]), "a");
    expect(a.parentId).toBeUndefined();
    expect(a.data.containerId).toBeNull();
    expect(a.position).toEqual({ x: 500, y: 500 });
  });

  it("moves a component from one container into another", () => {
    const nodes = [container("c1", 0, 0), container("c2", 400, 0), block("a", 20, 50, "c1")];
    const a = byId(dropIntoContainers(nodes, [{ id: "a", position: { x: 450, y: 60 } }]), "a");
    expect(a.parentId).toBe("c2");
    expect(a.data.containerId).toBe("c2");
    expect(a.position).toEqual({ x: 50, y: 60 });
  });

  it("puts a loose component into the container under its centre, clear of the header", () => {
    const nodes = [container("c", 100, 100), block("a", 0, 0)];
    // Centre lands inside the container, but the top-left corner is above its header.
    const a = byId(dropIntoContainers(nodes, [{ id: "a", position: { x: 110, y: 90 } }]), "a");
    expect(a.parentId).toBe("c");
    expect(a.position).toEqual({ x: CONTAINER_PADDING, y: CONTAINER_HEADER });
  });

  it("keeps a component in its container when only its edge pokes out, growing the container", () => {
    const nodes = [container("c", 0, 0, 300, 200), block("a", 20, 50, "c")];
    const out = dropIntoContainers(nodes, [{ id: "a", position: { x: 240, y: 50 } }]);
    expect(byId(out, "a").parentId).toBe("c");
    expect(byId(out, "c").size.width).toBe(240 + 100 + CONTAINER_PADDING);
  });

  it("leaves children alone when their container is dragged with them", () => {
    const nodes = [container("c", 0, 0), block("a", 20, 50, "c")];
    expect(
      dropIntoContainers(nodes, [
        { id: "c", position: { x: 900, y: 900 } },
        { id: "a", position: { x: 20, y: 50 } },
      ]),
    ).toEqual(nodes);
  });

  it("returns the same nodes when nothing changes", () => {
    const nodes = [container("c", 0, 0), block("a", 20, 50, "c")];
    const out = dropIntoContainers(nodes, [{ id: "a", position: { x: 20, y: 50 } }]);
    expect(out.every((node, index) => node === nodes[index])).toBe(true);
  });
});

describe("contentExtents", () => {
  it("gives each container how far its components reach, once per nodes array", () => {
    const nodes = [container("c", 0, 0), block("a", 16, 40, "c"), block("b", 140, 90, "c", 100, 60), block("loose", 900, 900)];
    const extents = contentExtents(nodes);
    expect(extents.get("c")).toEqual({ right: 240, bottom: 150 });
    expect(extents.has("loose")).toBe(false);
    expect(contentExtents(nodes)).toBe(extents);
    expect(contentExtents([...nodes])).not.toBe(extents);
  });
});

describe("nested containers", () => {
  const nested = (id: string, x: number, y: number, parentId: string, width = 200, height = 120): DiagramNode => ({
    ...container(id, x, y, width, height),
    parentId,
  });

  it("adds up every container's position for a box nested two deep", () => {
    const nodes = [container("o", 100, 100, 600, 400), nested("i", 20, 50, "o", 300, 200), block("a", 16, 40, "i")];
    expect(absolutePosition(byId(nodes, "a"), nodes)).toEqual({ x: 136, y: 190 });
  });

  it("drops a container into the container under its centre, keeping it where it is on screen", () => {
    const nodes = [container("o", 0, 0, 600, 400), container("c", 100, 100, 200, 120), block("a", 20, 50, "c")];
    const out = dropIntoContainers(nodes, [{ id: "c", position: { x: 100, y: 100 } }]);
    expect(byId(out, "c").parentId).toBe("o");
    expect(byId(out, "c").position).toEqual({ x: 100, y: 100 });
    // Its component comes with it.
    expect(byId(out, "a").parentId).toBe("c");
    expect(absolutePosition(byId(out, "a"), out)).toEqual({ x: 120, y: 150 });
  });

  it("drops a component into the innermost container under it", () => {
    const nodes = [container("o", 0, 0, 600, 400), nested("i", 100, 100, "o", 300, 200), block("a", 500, 500)];
    const out = dropIntoContainers(nodes, [{ id: "a", position: { x: 200, y: 200 } }]);
    expect(byId(out, "a").parentId).toBe("i");
    expect(absolutePosition(byId(out, "a"), out)).toEqual({ x: 200, y: 200 });
  });

  it("takes a nested container out to the canvas when dropped outside every container", () => {
    const nodes = [container("o", 0, 0, 600, 400), nested("i", 100, 100, "o")];
    const out = dropIntoContainers(nodes, [{ id: "i", position: { x: 900, y: 900 } }]);
    expect(byId(out, "i").parentId).toBeUndefined();
    expect(byId(out, "i").position).toEqual({ x: 900, y: 900 });
  });

  it("never puts a container inside what it holds", () => {
    // The outer container's centre is over its own nested container, which moves with it.
    const nodes = [container("o", 0, 0, 300, 200), nested("i", 16, 40, "o", 268, 144)];
    const out = dropIntoContainers(nodes, [{ id: "o", position: { x: 0, y: 0 } }]);
    expect(byId(out, "o").parentId).toBeUndefined();
    expect(byId(out, "i").parentId).toBe("o");
  });

  it("grows every container up the chain when a box pokes out", () => {
    const nodes = [container("o", 0, 0, 300, 200), nested("i", 16, 40, "o", 200, 120), block("a", 250, 40, "i")];
    const out = growContainerToFit(nodes, "i");
    expect(byId(out, "i").size.width).toBe(250 + 100 + CONTAINER_PADDING);
    expect(byId(out, "o").size.width).toBe(16 + byId(out, "i").size.width + CONTAINER_PADDING);
  });

  it("nudges a nested container's contents with it", () => {
    const nodes = [container("o", 0, 0, 600, 400), nested("i", 20, 50, "o"), block("a", 16, 40, "i")];
    const out = nudgeNodes(nodes, ["o", "i", "a"], 10, 0);
    expect(byId(out, "o").position).toEqual({ x: 10, y: 0 });
    expect(byId(out, "i").position).toEqual({ x: 20, y: 50 });
    expect(byId(out, "a").position).toEqual({ x: 16, y: 40 });
  });

  it("lays out nested containers along with components in Tidy", () => {
    const nodes = [container("o", 0, 0, 800, 400), nested("i", 300, 200, "o"), block("a", 20, 50, "o")];
    const out = tidyContainer(nodes, "o");
    expect(byId(out, "a").position).toEqual({ x: CONTAINER_PADDING, y: CONTAINER_HEADER });
    expect(byId(out, "i").position.y).toBe(CONTAINER_HEADER);
  });

  it("puts parents before what's inside them", () => {
    const nodes = [block("a", 0, 0, "i"), nested("i", 0, 0, "o"), container("o", 0, 0)];
    expect(parentsFirst(nodes).map((node) => node.id)).toEqual(["o", "i", "a"]);
    const ordered = parentsFirst(nodes);
    expect(parentsFirst(ordered)).toBe(ordered);
  });

  it("keeps nested containers inside their container in the tab-wide tidy layout", () => {
    const nodes = [container("o", 0, 0, 600, 400), nested("i", 20, 50, "o"), block("a", 16, 40, "i"), block("b", 900, 0)];
    const edges = [{ id: "e", source: "a", target: "b" }];
    const out = tidyLayout(nodes, edges, "LR").nodes;
    expect(byId(out, "i").parentId).toBe("o");
    expect(byId(out, "a").parentId).toBe("i");
    const outer = byId(out, "o");
    const inner = byId(out, "i");
    expect(inner.position.x + inner.size.width).toBeLessThanOrEqual(outer.size.width);
    expect(inner.position.y + inner.size.height).toBeLessThanOrEqual(outer.size.height);
    // The outer container is laid out before the component its contents connect to.
    expect(outer.position.x).toBeLessThan(byId(out, "b").position.x);
  });
});
