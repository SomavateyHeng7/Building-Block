import { describe, expect, it } from "vitest";
import { tidyLayout } from "@/lib/diagram/layout/autoLayout";
import { absolutePosition, growContainerToFit } from "@/lib/diagram/layout/layout";
import type { DiagramEdge, DiagramNode } from "@/lib/diagram/types";

const block = (id: string, x: number, y: number, parentId?: string): DiagramNode => ({
  id,
  type: "block",
  position: { x, y },
  size: { width: 140, height: 56 },
  parentId,
  data: { kind: "block", label: id, containerId: parentId ?? null },
});
const container = (id: string, x: number, y: number, width = 300, height = 200): DiagramNode => ({
  id,
  type: "container",
  position: { x, y },
  size: { width, height },
  data: { kind: "container", label: id },
});
const link = (id: string, source: string, target: string, extra: Partial<DiagramEdge> = {}): DiagramEdge => ({
  id, source, target, ...extra,
});
const abs = (nodes: DiagramNode[], id: string) => absolutePosition(nodes.find((node) => node.id === id)!, nodes);
const overlap = (a: DiagramNode, b: DiagramNode, all: DiagramNode[]) => {
  const p = absolutePosition(a, all);
  const q = absolutePosition(b, all);
  return p.x < q.x + b.size.width && q.x < p.x + a.size.width && p.y < q.y + b.size.height && q.y < p.y + a.size.height;
};

// Three containers dumped on top of each other, joined in a chain, plus a stray box.
const messy = (): { nodes: DiagramNode[]; edges: DiagramEdge[] } => ({
  nodes: [
    container("web", 0, 0),
    block("ui", 20, 50, "web"),
    block("admin", 20, 120, "web"),
    container("app", 10, 10),
    block("api", 20, 50, "app"),
    container("data", 20, 20),
    block("db", 20, 50, "data"),
    block("stray", 5, 5),
  ],
  edges: [link("e1", "ui", "api"), link("e2", "admin", "api"), link("e3", "api", "db"), link("loop", "db", "ui", { style: "dashed", bend: { x: 40, y: 0 } })],
});

describe("tidyLayout", () => {
  it("puts containers in columns following the flow, and loop-backs don't push anything", () => {
    const { nodes, edges } = messy();
    const result = tidyLayout(nodes, edges, "LR");
    const x = (id: string) => result.nodes.find((node) => node.id === id)!.position.x;
    expect(x("web")).toBeLessThan(x("app"));
    expect(x("app")).toBeLessThan(x("data"));
  });

  it("leaves nothing on top of anything else, inside containers or between them", () => {
    const { nodes, edges } = messy();
    for (const direction of ["LR", "TB"] as const) {
      const result = tidyLayout(nodes, edges, direction).nodes;
      const tops = result.filter((node) => !node.parentId);
      for (const [i, a] of tops.entries()) for (const b of tops.slice(i + 1)) expect(overlap(a, b, result)).toBe(false);
      const inWeb = result.filter((node) => node.parentId === "web");
      expect(overlap(inWeb[0], inWeb[1], result)).toBe(false);
    }
  });

  it("wraps each container round its components, with nothing outside it", () => {
    const { nodes, edges } = messy();
    const result = tidyLayout(nodes, edges, "LR").nodes;
    for (const id of ["web", "app", "data"]) expect(growContainerToFit(result, id)).toEqual(result);
    for (const node of result.filter((candidate) => candidate.parentId)) {
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("goes down the page instead for top to bottom", () => {
    const { nodes, edges } = messy();
    const result = tidyLayout(nodes, edges, "TB").nodes;
    const y = (id: string) => result.find((node) => node.id === id)!.position.y;
    expect(y("web")).toBeLessThan(y("app"));
    expect(y("app")).toBeLessThan(y("data"));
  });

  it("puts boxes with no connections after the rest, and keeps every node and size", () => {
    const { nodes, edges } = messy();
    const result = tidyLayout(nodes, edges, "LR").nodes;
    const right = Math.max(...["web", "app", "data"].map((id) => abs(result, id).x));
    expect(abs(result, "stray").x).toBeGreaterThan(right);
    expect(result.map((node) => node.id)).toEqual(nodes.map((node) => node.id));
    for (const node of result.filter((candidate) => candidate.type === "block")) {
      expect(node.size).toEqual(nodes.find((original) => original.id === node.id)!.size);
    }
    expect(result.find((node) => node.id === "ui")!.parentId).toBe("web");
  });

  it("re-attaches connections to facing sides and clears bends, keeping their text and style", () => {
    const { nodes, edges } = messy();
    const result = tidyLayout(nodes, edges.map((edge) => ({ ...edge, label: `L-${edge.id}` })), "LR").edges;
    expect(result.map((edge) => edge.id)).toEqual(edges.map((edge) => edge.id));
    expect(result.find((edge) => edge.id === "e1")).toMatchObject({ sourceSide: "right", targetSide: "left", label: "L-e1" });
    expect(result.find((edge) => edge.id === "loop")!.bend).toBeUndefined();
    expect(result.find((edge) => edge.id === "loop")!.style).toBe("dashed");
  });

  it("does not change its input, and gives the same layout when run again", () => {
    const { nodes, edges } = messy();
    const before = JSON.stringify({ nodes, edges });
    const once = tidyLayout(nodes, edges, "LR");
    expect(JSON.stringify({ nodes, edges })).toBe(before);
    const twice = tidyLayout(once.nodes, once.edges, "LR");
    expect(twice.nodes.map((node) => [node.id, node.position, node.size])).toEqual(
      once.nodes.map((node) => [node.id, node.position, node.size]),
    );
  });

  it("copes with cycles, a diagram with no connections, and an empty one", () => {
    const loop = [block("a", 0, 0), block("b", 300, 0)];
    const cycle = tidyLayout(loop, [link("ab", "a", "b"), link("ba", "b", "a")], "LR").nodes;
    expect(abs(cycle, "a").x).toBeLessThan(abs(cycle, "b").x);
    const loose = Array.from({ length: 30 }, (_, i) => block(`n${i}`, (i % 5) * 10, Math.floor(i / 5) * 10));
    const grid = tidyLayout(loose, [], "LR").nodes;
    for (const [i, a] of grid.entries()) for (const b of grid.slice(i + 1)) expect(overlap(a, b, grid)).toBe(false);
    expect(Math.max(...grid.map((node) => node.position.y + node.size.height))).toBeLessThanOrEqual(900);
    expect(tidyLayout([], [], "LR")).toEqual({ nodes: [], edges: [] });
  });

  it("ignores connections to things that are not there", () => {
    const result = tidyLayout([block("a", 0, 0)], [link("x", "a", "ghost")], "LR");
    expect(result.edges).toHaveLength(1);
    expect(result.nodes).toHaveLength(1);
  });

  it("orders a column to keep connections short, so lines do not cross when they need not", () => {
    // Two sources and two targets, drawn crossed: s1 -> t1, s2 -> t2, but t2 sits above t1.
    const nodes = [block("s1", 0, 0), block("s2", 0, 200), block("t2", 400, 0), block("t1", 400, 200)];
    const result = tidyLayout(nodes, [link("a", "s1", "t1"), link("b", "s2", "t2")], "LR").nodes;
    const y = (id: string) => abs(result, id).y;
    expect(y("s1") < y("s2")).toBe(y("t1") < y("t2"));
  });
});
