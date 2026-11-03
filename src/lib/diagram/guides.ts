import type { Position, Size } from "./types";

/**
 * Pixel guides for moving boxes: snapping the moved box to the edges and middles of the others, the lines
 * that show what it lines up with, and the gaps to its nearest neighbours. Everything is in canvas pixels.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A guide line across the canvas: vertical at `x` or horizontal at `y`, drawn from `from` to `to`. */
export interface GuideLine {
  axis: "x" | "y";
  at: number;
  from: number;
  to: number;
}

/** The space between two boxes: a measured line with its length in pixels. */
export interface Gap {
  axis: "x" | "y";
  /** Where along the other axis the measure is drawn. */
  at: number;
  from: number;
  to: number;
  length: number;
}

export interface SnapResult {
  /** How far to move the box so it lines up (0 when nothing is close enough). */
  dx: number;
  dy: number;
  lines: GuideLine[];
}

export function boxOf(position: Position, size: Size): Box {
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

/** The bounding box of several boxes. */
export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

const xStops = (box: Box) => [box.x, box.x + box.width / 2, box.x + box.width];
const yStops = (box: Box) => [box.y, box.y + box.height / 2, box.y + box.height];

/**
 * The smallest move (within `threshold`) that puts one of the box's left/middle/right lines on one of another
 * box's, and the same for top/middle/bottom; with the guide lines to draw once moved.
 */
export function snapToBoxes(moving: Box, others: Box[], threshold: number): SnapResult {
  function best(stops: (box: Box) => number[]) {
    let delta = Infinity;
    for (const other of others) {
      for (const target of stops(other)) {
        for (const own of stops(moving)) {
          const candidate = target - own;
          if (Math.abs(candidate) <= threshold && Math.abs(candidate) < Math.abs(delta)) delta = candidate;
        }
      }
    }
    return Number.isFinite(delta) ? delta : 0;
  }
  const dx = best(xStops);
  const dy = best(yStops);
  const moved = { ...moving, x: moving.x + dx, y: moving.y + dy };
  return { dx, dy, lines: alignmentLines(moved, others) };
}

/** Lines through every edge or middle the box shares exactly (to the pixel) with another box. */
export function alignmentLines(box: Box, others: Box[]): GuideLine[] {
  const lines: GuideLine[] = [];
  const same = (a: number, b: number) => Math.abs(a - b) < 0.5;
  for (const own of xStops(box)) {
    const matches = others.filter((other) => xStops(other).some((stop) => same(stop, own)));
    if (!matches.length) continue;
    const all = [box, ...matches];
    lines.push({
      axis: "x",
      at: own,
      from: Math.min(...all.map((item) => item.y)),
      to: Math.max(...all.map((item) => item.y + item.height)),
    });
  }
  for (const own of yStops(box)) {
    const matches = others.filter((other) => yStops(other).some((stop) => same(stop, own)));
    if (!matches.length) continue;
    const all = [box, ...matches];
    lines.push({
      axis: "y",
      at: own,
      from: Math.min(...all.map((item) => item.x)),
      to: Math.max(...all.map((item) => item.x + item.width)),
    });
  }
  return lines;
}

/**
 * The gap from the box to the nearest box on each side (left, right, above, below) that it faces: one that
 * overlaps it across the other axis. Boxes it overlaps or sits inside (its container) aren't measured.
 */
export function nearestGaps(box: Box, others: Box[]): Gap[] {
  const gaps: Gap[] = [];
  const overlapY = (other: Box) => other.y < box.y + box.height && other.y + other.height > box.y;
  const overlapX = (other: Box) => other.x < box.x + box.width && other.x + other.width > box.x;
  const middle = (a0: number, a1: number, b0: number, b1: number) => (Math.max(a0, b0) + Math.min(a1, b1)) / 2;

  const left = others.filter((other) => overlapY(other) && other.x + other.width <= box.x);
  const right = others.filter((other) => overlapY(other) && other.x >= box.x + box.width);
  const above = others.filter((other) => overlapX(other) && other.y + other.height <= box.y);
  const below = others.filter((other) => overlapX(other) && other.y >= box.y + box.height);

  const nearest = (items: Box[], distance: (other: Box) => number) =>
    items.reduce<Box | null>((found, other) => (!found || distance(other) < distance(found) ? other : found), null);

  const l = nearest(left, (other) => box.x - (other.x + other.width));
  if (l) {
    const from = l.x + l.width;
    gaps.push({ axis: "x", at: middle(box.y, box.y + box.height, l.y, l.y + l.height), from, to: box.x, length: box.x - from });
  }
  const r = nearest(right, (other) => other.x - (box.x + box.width));
  if (r) {
    const from = box.x + box.width;
    gaps.push({ axis: "x", at: middle(box.y, box.y + box.height, r.y, r.y + r.height), from, to: r.x, length: r.x - from });
  }
  const a = nearest(above, (other) => box.y - (other.y + other.height));
  if (a) {
    const from = a.y + a.height;
    gaps.push({ axis: "y", at: middle(box.x, box.x + box.width, a.x, a.x + a.width), from, to: box.y, length: box.y - from });
  }
  const b = nearest(below, (other) => other.y - (box.y + box.height));
  if (b) {
    const from = box.y + box.height;
    gaps.push({ axis: "y", at: middle(box.x, box.x + box.width, b.x, b.x + b.width), from, to: b.y, length: b.y - from });
  }
  return gaps.map((gap) => ({ ...gap, length: Math.round(gap.length) }));
}

/**
 * Distances from one box to another anywhere on the canvas, for comparing them (Alt + hover): the horizontal
 * and vertical space between them, or how far each edge is inside when one contains the other.
 */
export function distancesBetween(box: Box, other: Box): Gap[] {
  const gaps: Gap[] = [];
  const cy = box.y + box.height / 2;
  const cx = box.x + box.width / 2;
  const push = (axis: "x" | "y", at: number, a: number, b: number) => {
    if (Math.abs(b - a) >= 0.5) gaps.push({ axis, at, from: Math.min(a, b), to: Math.max(a, b), length: Math.round(Math.abs(b - a)) });
  };
  const inside = other.x <= box.x && other.y <= box.y && other.x + other.width >= box.x + box.width && other.y + other.height >= box.y + box.height;
  const contains = box.x <= other.x && box.y <= other.y && box.x + box.width >= other.x + other.width && box.y + box.height >= other.y + other.height;
  if (inside || contains) {
    const [inner, outer] = inside ? [box, other] : [other, box];
    const icx = inner.x + inner.width / 2;
    const icy = inner.y + inner.height / 2;
    push("x", icy, outer.x, inner.x);
    push("x", icy, inner.x + inner.width, outer.x + outer.width);
    push("y", icx, outer.y, inner.y);
    push("y", icx, inner.y + inner.height, outer.y + outer.height);
    return gaps;
  }
  if (other.x + other.width <= box.x) push("x", cy, other.x + other.width, box.x);
  else if (other.x >= box.x + box.width) push("x", cy, box.x + box.width, other.x);
  if (other.y + other.height <= box.y) push("y", cx, other.y + other.height, box.y);
  else if (other.y >= box.y + box.height) push("y", cx, box.y + box.height, other.y);
  return gaps;
}
