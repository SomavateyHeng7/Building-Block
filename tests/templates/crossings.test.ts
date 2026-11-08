import { describe, expect, it } from "vitest";
import { allTemplates } from "@/templates";
import type { DiagramEdge, DiagramNode } from "@/lib/diagram/types";

interface Rect { x: number; y: number; w: number; h: number }

function absoluteRects(nodes: DiagramNode[]): Map<string, Rect> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const rects = new Map<string, Rect>();
  for (const node of nodes) {
    let { x, y } = node.position;
    for (let parent = node.parentId ? byId.get(node.parentId) : undefined; parent; parent = parent.parentId ? byId.get(parent.parentId) : undefined) {
      x += parent.position.x;
      y += parent.position.y;
    }
    rects.set(node.id, { x, y, w: node.size?.width ?? 0, h: node.size?.height ?? 0 });
  }
  return rects;
}

function anchor(rect: Rect, side: string | undefined): [number, number] {
  switch (side) {
    case "left": return [rect.x, rect.y + rect.h / 2];
    case "right": return [rect.x + rect.w, rect.y + rect.h / 2];
    case "top": return [rect.x + rect.w / 2, rect.y];
    default: return [rect.x + rect.w / 2, rect.y + rect.h];
  }
}

/** Whether the straight segment a→b passes through the rectangle (Liang–Barsky). */
function crosses([ax, ay]: [number, number], [bx, by]: [number, number], r: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  for (const [p, q] of [[-dx, ax - r.x], [dx, r.x + r.w - ax], [-dy, ay - r.y], [dy, r.y + r.h - ay]]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** Connections whose straight line between the two facing sides runs through a component that is neither end. */
function crossings(nodes: DiagramNode[], edges: DiagramEdge[]): string[] {
  const rects = absoluteRects(nodes);
  const labelOf = new Map(nodes.map((node) => [node.id, node.data.label]));
  const found: string[] = [];
  for (const edge of edges) {
    const from = rects.get(edge.source);
    const to = rects.get(edge.target);
    if (!from || !to) continue;
    // Leaving and returning on the same side is a loop-back routed around the boxes, not a straight line.
    if (edge.sourceSide === edge.targetSide) continue;
    const a = anchor(from, edge.sourceSide);
    const b = anchor(to, edge.targetSide);
    for (const node of nodes) {
      if (node.type !== "block" || node.id === edge.source || node.id === edge.target) continue;
      if (crosses(a, b, rects.get(node.id)!)) found.push(`${labelOf.get(edge.source)} → ${labelOf.get(edge.target)} runs through ${labelOf.get(node.id)}`);
    }
  }
  return found;
}

describe("template connections stay clear of other components", () => {
  for (const template of allTemplates) {
    for (const orientation of template.orientable ? (["vertical", "horizontal"] as const) : (["vertical"] as const)) {
      it(`${template.name} (${orientation})`, () => {
        for (const section of template.build({ orientation }).sections) {
          expect(crossings(section.nodes, section.edges ?? [])).toEqual([]);
        }
      });
    }
  }
});
