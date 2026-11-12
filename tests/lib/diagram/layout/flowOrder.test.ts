import { describe, expect, it } from "vitest";
import { numberInFlowOrder } from "@/lib/diagram/layout/flowOrder";
import type { DiagramEdge, DiagramNode } from "@/lib/diagram/types";

const box = (id: string, x: number, y: number): DiagramNode => ({
  id,
  type: "block",
  position: { x, y },
  size: { width: 100, height: 40 },
  data: { kind: "block", label: id, containerId: null },
});
const link = (id: string, source: string, target: string, dashed = false): DiagramEdge => ({
  id,
  source,
  target,
  ...(dashed ? { style: "dashed" as const } : {}),
});
const steps = (edges: DiagramEdge[]) => Object.fromEntries(edges.map((edge) => [edge.id, edge.step]));

describe("numberInFlowOrder", () => {
  it("numbers a chain from its start, whatever order the connections were drawn in", () => {
    const nodes = [box("a", 0, 0), box("b", 200, 0), box("c", 400, 0)];
    const edges = [link("bc", "b", "c"), link("ab", "a", "b")];
    expect(steps(numberInFlowOrder(nodes, edges))).toEqual({ ab: 1, bc: 2 });
  });

  it("numbers a branch top to bottom, then follows each branch on", () => {
    const nodes = [box("a", 0, 0), box("low", 200, 100), box("high", 200, 0), box("end", 400, 0)];
    const edges = [link("a-low", "a", "low"), link("a-high", "a", "high"), link("high-end", "high", "end")];
    expect(steps(numberInFlowOrder(nodes, edges))).toEqual({ "a-high": 1, "a-low": 2, "high-end": 3 });
  });

  it("numbers dashed loop-backs last, and a node that only dashed lines reach still counts as a start", () => {
    const nodes = [box("draft", 0, 0), box("approve", 200, 0), box("pay", 400, 0)];
    const edges = [link("back", "approve", "draft", true), link("ok", "approve", "pay"), link("send", "draft", "approve")];
    expect(steps(numberInFlowOrder(nodes, edges))).toEqual({ send: 1, ok: 2, back: 3 });
  });

  it("starts a cycle at its left-most component, and numbers separate flows one after the other", () => {
    const cycle = [box("x", 0, 0), box("y", 200, 0)];
    expect(steps(numberInFlowOrder(cycle, [link("yx", "y", "x"), link("xy", "x", "y")]))).toEqual({ xy: 1, yx: 2 });
    const two = [box("a", 0, 0), box("b", 200, 0), box("c", 0, 300), box("d", 200, 300)];
    expect(steps(numberInFlowOrder(two, [link("cd", "c", "d"), link("ab", "a", "b")]))).toEqual({ ab: 1, cd: 2 });
  });

  it("gives every connection a different whole number, and leaves the input alone", () => {
    const nodes = [box("a", 0, 0), box("b", 200, 0), box("c", 200, 100)];
    const edges = [link("1", "a", "b"), link("2", "a", "c"), link("3", "b", "c"), link("4", "c", "a", true)];
    const result = numberInFlowOrder(nodes, edges);
    expect(result.map((edge) => edge.step).sort()).toEqual([1, 2, 3, 4]);
    expect(edges.every((edge) => edge.step === undefined)).toBe(true);
    expect(numberInFlowOrder(nodes, [])).toEqual([]);
  });
});
