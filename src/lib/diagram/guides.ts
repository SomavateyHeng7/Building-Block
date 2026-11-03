/** A box on the canvas, in canvas coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A line to draw while dragging: `at` is where it crosses its axis, `from` to `to` how far it runs. */
export interface GuideLine {
  axis: "x" | "y";
  at: number;
  from: number;
  to: number;
}

export interface Snap {
  /** How far to move the dragged boxes to line up. */
  dx: number;
  dy: number;
  lines: GuideLine[];
}

const anchors = (start: number, size: number) => [start, start + size / 2, start + size];
const TOLERANCE = 0.5;

/**
 * Where a dragged box lines up with the others: its edges and middle against theirs. Within `threshold`, the
 * nearest match on each axis pulls it into line (`dx`, `dy`), and `lines` are the guides to draw, running across
 * every box that shares the line.
 */
export function snapToOthers(moving: Rect, others: readonly Rect[], threshold: number): Snap {
  const nearest = (mine: number[], theirs: (rect: Rect) => number[]) => {
    let best: number | null = null;
    for (const rect of others) {
      for (const target of theirs(rect)) {
        for (const source of mine) {
          const delta = target - source;
          if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best))) best = delta;
        }
      }
    }
    return best ?? 0;
  };

  const dx = nearest(anchors(moving.x, moving.width), (rect) => anchors(rect.x, rect.width));
  const dy = nearest(anchors(moving.y, moving.height), (rect) => anchors(rect.y, rect.height));
  const snapped: Rect = { ...moving, x: moving.x + dx, y: moving.y + dy };

  const lines: GuideLine[] = [];
  const draw = (axis: "x" | "y") => {
    const vertical = axis === "x";
    const mine = vertical ? anchors(snapped.x, snapped.width) : anchors(snapped.y, snapped.height);
    const span = (rect: Rect): [number, number] => (vertical ? [rect.y, rect.y + rect.height] : [rect.x, rect.x + rect.width]);
    const found = new Map<number, [number, number]>();
    for (const at of mine) {
      for (const rect of others) {
        const theirs = vertical ? anchors(rect.x, rect.width) : anchors(rect.y, rect.height);
        if (!theirs.some((value) => Math.abs(value - at) <= TOLERANCE)) continue;
        const [from, to] = span(rect);
        const [mineFrom, mineTo] = span(snapped);
        const key = Math.round(at * 2) / 2;
        const current = found.get(key) ?? [mineFrom, mineTo];
        found.set(key, [Math.min(current[0], from), Math.max(current[1], to)]);
      }
    }
    for (const [at, [from, to]] of found) lines.push({ axis, at, from, to });
  };
  draw("x");
  draw("y");
  return { dx, dy, lines };
}
