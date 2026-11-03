import { describe, expect, it } from "vitest";
import { alignmentLines, distancesBetween, nearestGaps, snapToBoxes, unionBox } from "@/lib/diagram/guides";

const box = (x: number, y: number, width = 100, height = 40) => ({ x, y, width, height });

describe("snapToBoxes", () => {
  it("snaps a near edge onto another box's edge and draws the guide", () => {
    const result = snapToBoxes(box(203, 300), [box(200, 100)], 6);
    expect(result.dx).toBe(-3);
    expect(result.lines.some((line) => line.axis === "x" && line.at === 200)).toBe(true);
  });

  it("snaps middles too", () => {
    // Middle at 252 vs 250.
    const result = snapToBoxes(box(202, 300), [box(200, 100)], 1.5);
    expect(result.dx).toBe(0);
    const middle = snapToBoxes(box(150, 0, 204, 20), [box(200, 100)], 3);
    expect(middle.dx).toBe(-2);
  });

  it("leaves a box alone when nothing is within the threshold", () => {
    expect(snapToBoxes(box(500, 500), [box(0, 0)], 6)).toMatchObject({ dx: 0, dy: 0, lines: [] });
  });
});

describe("alignmentLines", () => {
  it("spans both boxes along a shared edge", () => {
    expect(alignmentLines(box(0, 200), [box(0, 0)])).toContainEqual({ axis: "x", at: 0, from: 0, to: 240 });
  });
});

describe("nearestGaps", () => {
  it("measures the gap to the closest facing box on each side", () => {
    const gaps = nearestGaps(box(200, 0), [box(0, 0), box(50, 0), box(330, 10), box(200, 100)]);
    expect(gaps).toContainEqual(expect.objectContaining({ axis: "x", from: 150, to: 200, length: 50 }));
    expect(gaps).toContainEqual(expect.objectContaining({ axis: "x", from: 300, to: 330, length: 30 }));
    expect(gaps).toContainEqual(expect.objectContaining({ axis: "y", from: 40, to: 100, length: 60 }));
  });

  it("ignores boxes it doesn't face", () => {
    expect(nearestGaps(box(0, 0), [box(500, 500)])).toEqual([]);
  });
});

describe("distancesBetween", () => {
  it("gives the horizontal and vertical space between separate boxes", () => {
    const gaps = distancesBetween(box(0, 0), box(150, 90));
    expect(gaps.map((gap) => [gap.axis, gap.length])).toEqual([
      ["x", 50],
      ["y", 50],
    ]);
  });

  it("gives each edge's inset when one box is inside the other", () => {
    const gaps = distancesBetween(box(16, 40, 100, 40), box(0, 0, 200, 120));
    expect(gaps.map((gap) => gap.length)).toEqual([16, 84, 40, 40]);
  });
});

describe("unionBox", () => {
  it("bounds several boxes", () => {
    expect(unionBox([box(0, 0), box(200, 100)])).toEqual({ x: 0, y: 0, width: 300, height: 140 });
    expect(unionBox([])).toBeNull();
  });
});
