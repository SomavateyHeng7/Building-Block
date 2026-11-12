import { describe, expect, it } from "vitest";
import { alignmentLines, distancesBetween, nearestGaps, snapResize, snapToBoxes, unionBox } from "@/lib/diagram/layout/guides";

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

describe("snapResize", () => {
  const right = { left: false, right: true, top: false, bottom: false };
  const left = { left: true, right: false, top: false, bottom: false };
  const bottom = { left: false, right: false, top: false, bottom: true };
  const min = { width: 80, height: 32 };

  it("snaps the moving edge to another box's edge and draws the guide", () => {
    // Right edge at 297 vs the other's right edge at 300 (the other box is 160 wide, so it isn't a width match).
    const result = snapResize(box(0, 200, 297), right, [box(140, 0, 160)], 6, min);
    expect(result.box).toEqual(box(0, 200, 300));
    expect(result.lines).toContainEqual(expect.objectContaining({ axis: "x", at: 300 }));
  });

  it("snaps to the same width as another box and marks both widths", () => {
    const other = box(400, 0, 120);
    const result = snapResize(box(0, 200, 116), right, [other], 6, min);
    expect(result.box.width).toBe(120);
    expect(result.sizes).toContainEqual(expect.objectContaining({ kind: "size", axis: "x", from: 0, to: 120, length: 120 }));
    expect(result.sizes).toContainEqual(expect.objectContaining({ kind: "size", axis: "x", from: 400, to: 520, length: 120 }));
  });

  it("keeps the fixed edge where it is when the left edge moves", () => {
    const result = snapResize(box(103, 200, 97), left, [box(100, 0, 300)], 6, min);
    expect(result.box).toEqual(box(100, 200, 100));
  });

  it("matches heights when resizing down", () => {
    const result = snapResize(box(0, 0, 100, 58), bottom, [box(300, 300, 100, 60)], 6, min);
    expect(result.box.height).toBe(60);
    expect(result.sizes.filter((size) => size.axis === "y")).toHaveLength(2);
  });

  it("doesn't snap below the minimum size", () => {
    const result = snapResize(box(0, 0, 82), right, [box(200, 0, 78, 20)], 6, min);
    expect(result.box.width).toBe(82);
  });

  it("only reports exact matches with no threshold (Alt)", () => {
    const result = snapResize(box(0, 200, 118), right, [box(400, 0, 120)], 0, min);
    expect(result.box.width).toBe(118);
    expect(result.sizes).toEqual([]);
  });
});
