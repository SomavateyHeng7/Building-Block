import type { ConnectionSide, DiagramEdge, Position } from "./types";

/** How far apart parallel lines are drawn. */
const SPACING = 14;
/** The most a line moves along a side, so its end stays on even the smallest component. */
const REACH = 12;

/** How far to move where a connection meets each of its two ends. */
export interface EndShift {
  source: Position;
  target: Position;
}

const along = (side: ConnectionSide, distance: number): Position =>
  side === "left" || side === "right" ? { x: 0, y: distance } : { x: distance, y: 0 };

/**
 * Connections that would be drawn on top of each other (they join the same two sides, in either direction)
 * are moved apart, each along its side, so every line can be seen and followed. Only those that overlap are
 * returned; a connection on its own is drawn where it always was. Nothing is saved: it's worked out as the
 * diagram is drawn, so it follows the components as they move.
 */
export function parallelShifts(edges: readonly DiagramEdge[]): Map<string, EndShift> {
  const groups = new Map<string, DiagramEdge[]>();
  for (const edge of edges) {
    if (!edge.sourceSide || !edge.targetSide) continue;
    const key = [`${edge.source}:${edge.sourceSide}`, `${edge.target}:${edge.targetSide}`].sort().join("|");
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  }
  const shifts = new Map<string, EndShift>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const spacing = Math.min(SPACING, (2 * REACH) / (group.length - 1));
    group.forEach((edge, index) => {
      const distance = (index - (group.length - 1) / 2) * spacing;
      shifts.set(edge.id, {
        source: along(edge.sourceSide!, distance),
        target: along(edge.targetSide!, distance),
      });
    });
  }
  return shifts;
}
