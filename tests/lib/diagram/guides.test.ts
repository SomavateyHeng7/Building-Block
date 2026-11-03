import { describe, expect, it } from "vitest";
import { snapToOthers, type Rect } from "@/lib/diagram/guides";

const rect = (x: number, y: number, width = 100, height = 40): Rect => ({ x, y, width, height });

describe("snapToOthers", () => {
  it("does nothing when nothing is close, or there is nothing to line up with", () => {
    expect(snapToOthers(rect(0, 0), [rect(500, 500)], 6)).toEqual({ dx: 0, dy: 0, lines: [] });
    expect(snapToOthers(rect(0, 0), [], 6)).toEqual({ dx: 0, dy: 0, lines: [] });
  });

  it("pulls a box into line with another's left edge, and draws a guide across both", () => {
    const snap = snapToOthers(rect(104, 200, 80, 40), [rect(100, 0)], 6);
    expect(snap.dx).toBe(-4);
    expect(snap.dy).toBe(0);
    expect(snap.lines).toEqual([{ axis: "x", at: 100, from: 0, to: 240 }]);
  });

  it("lines up middles as well as edges, and each axis on its own", () => {
    const middle = snapToOthers(rect(0, 0, 60, 40), [rect(300, -10, 200, 100)], 6);
    // Its middle (y 20) is 30 away from theirs (y 40): too far, so no vertical pull.
    expect(middle.dy).toBe(0);
    const centred = snapToOthers(rect(0, 17, 60, 40), [rect(300, -10, 200, 100)], 6);
    expect(centred.dy).toBe(3);
    expect(centred.lines.some((line) => line.axis === "y" && line.at === 40)).toBe(true);
  });

  it("takes the nearest match, not the first", () => {
    const snap = snapToOthers(rect(97, 0), [rect(90, 100), rect(100, 200)], 10);
    expect(snap.dx).toBe(3);
  });

  it("shows a guide while lined up, even with no pull needed, and one per line", () => {
    const snap = snapToOthers(rect(100, 100), [rect(100, 0), rect(100, 300)], 6);
    expect(snap.dx).toBe(0);
    expect(snap.lines.filter((line) => line.axis === "x" && line.at === 100)).toHaveLength(1);
    expect(snap.lines[0]).toMatchObject({ from: 0, to: 340 });
  });

  it("respects the threshold", () => {
    expect(snapToOthers(rect(107, 0), [rect(100, 100)], 6).dx).toBe(0);
    expect(snapToOthers(rect(106, 0), [rect(100, 100)], 6).dx).toBe(-6);
  });
});
