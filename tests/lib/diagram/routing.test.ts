import { describe, expect, it } from "vitest";
import { parallelShifts } from "@/lib/diagram/routing";
import type { DiagramEdge } from "@/lib/diagram/types";

const edge = (id: string, source: string, target: string, sourceSide: DiagramEdge["sourceSide"], targetSide: DiagramEdge["targetSide"]): DiagramEdge => ({
  id, source, target, sourceSide, targetSide,
});

describe("parallelShifts", () => {
  it("leaves a connection that is on its own where it is", () => {
    expect(parallelShifts([edge("a", "x", "y", "right", "left")]).size).toBe(0);
  });

  it("moves two connections on the same sides apart, in both directions of travel", () => {
    const shifts = parallelShifts([edge("fwd", "x", "y", "right", "left"), edge("back", "y", "x", "left", "right")]);
    const forward = shifts.get("fwd")!;
    const back = shifts.get("back")!;
    // Right and left sides run up and down, so the lines move up and down, by different amounts, at both ends.
    expect(forward.source.x).toBe(0);
    expect(forward.source.y).not.toBe(back.source.y);
    expect(forward.source).toEqual(forward.target);
    expect(Math.abs(forward.source.y - back.source.y)).toBeGreaterThanOrEqual(10);
  });

  it("moves lines on top and bottom sides sideways", () => {
    const shifts = parallelShifts([edge("a", "x", "y", "bottom", "top"), edge("b", "x", "y", "bottom", "top")]);
    expect(shifts.get("a")!.source.y).toBe(0);
    expect(shifts.get("a")!.source.x).toBe(-shifts.get("b")!.source.x);
  });

  it("does not group connections on different sides, or ones with no sides", () => {
    const shifts = parallelShifts([
      edge("a", "x", "y", "right", "left"),
      edge("b", "x", "y", "top", "top"),
      { id: "c", source: "x", target: "y" },
      { id: "d", source: "x", target: "y" },
    ]);
    expect(shifts.size).toBe(0);
  });

  it("spreads several lines evenly, centred, and keeps them within the side of a small component", () => {
    const edges = ["a", "b", "c", "d", "e"].map((id) => edge(id, "x", "y", "right", "left"));
    const ys = edges.map((item) => parallelShifts(edges).get(item.id)!.source.y);
    expect(ys.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0);
    expect(new Set(ys).size).toBe(5);
    expect(Math.max(...ys.map(Math.abs))).toBeLessThanOrEqual(12);
  });
});
