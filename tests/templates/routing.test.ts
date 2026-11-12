import { Position as Side } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { connectionPath } from "@/lib/diagram/layout/flowAdapter";
import { parallelShifts } from "@/lib/diagram/layout/routing";
import type { ConnectionSide, DiagramEdge, DiagramNode } from "@/lib/diagram/types";
import { templates } from "@/templates";

/**
 * Draws each template's connections as the editor does (right-angle lines from the middle of a side) and
 * checks the loop-backs on the swimlane templates: they mustn't cut through a step or run along another line.
 */

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type Segment = [Point, Point];

const SIDES: Record<ConnectionSide, Side> = { top: Side.Top, right: Side.Right, bottom: Side.Bottom, left: Side.Left };

function absoluteRects(nodes: DiagramNode[]): Map<string, Rect> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const rects = new Map<string, Rect>();
  for (const node of nodes) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const x = node.position.x + (parent?.position.x ?? 0);
    const y = node.position.y + (parent?.position.y ?? 0);
    rects.set(node.id, { x, y, width: node.size?.width ?? 0, height: node.size?.height ?? 0 });
  }
  return rects;
}

function handle(rect: Rect, side: ConnectionSide): Point {
  if (side === "top") return { x: rect.x + rect.width / 2, y: rect.y };
  if (side === "bottom") return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
  if (side === "left") return { x: rect.x, y: rect.y + rect.height / 2 };
  return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
}

/** The line as straight runs: every coordinate in the path, corners (curve control points) included. */
function draw(edge: DiagramEdge, rects: Map<string, Rect>, shifts: ReturnType<typeof parallelShifts>) {
  const shift = shifts.get(edge.id);
  const source = handle(rects.get(edge.source)!, edge.sourceSide!);
  const target = handle(rects.get(edge.target)!, edge.targetSide!);
  const { path, labelX, labelY } = connectionPath(
    {
      sourceX: source.x + (shift?.source.x ?? 0),
      sourceY: source.y + (shift?.source.y ?? 0),
      sourcePosition: SIDES[edge.sourceSide!],
      targetX: target.x + (shift?.target.x ?? 0),
      targetY: target.y + (shift?.target.y ?? 0),
      targetPosition: SIDES[edge.targetSide!],
    },
    edge.shape ?? "step",
    edge.bend,
  );
  const numbers = path.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const points: Point[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) points.push({ x: numbers[index], y: numbers[index + 1] });
  const segments: Segment[] = [];
  for (let index = 1; index < points.length; index++) segments.push([points[index - 1], points[index]]);
  return { segments, label: { x: labelX, y: labelY } };
}

const EPSILON = 0.5;

/** Whether an axis-aligned run passes through the inside of a box (touching its edge doesn't count). */
function cutsThrough([a, b]: Segment, rect: Rect): boolean {
  const [minX, maxX] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [minY, maxY] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return (
    maxX > rect.x + EPSILON &&
    minX < rect.x + rect.width - EPSILON &&
    maxY > rect.y + EPSILON &&
    minY < rect.y + rect.height - EPSILON
  );
}

/** How long two runs lie on top of each other (0 unless both are on one horizontal or vertical line). */
function overlap([a, b]: Segment, [c, d]: Segment): number {
  const horizontal = (p: Point, q: Point) => Math.abs(p.y - q.y) < EPSILON;
  const vertical = (p: Point, q: Point) => Math.abs(p.x - q.x) < EPSILON;
  const shared = (lo1: number, hi1: number, lo2: number, hi2: number) =>
    Math.max(0, Math.min(Math.max(lo1, hi1), Math.max(lo2, hi2)) - Math.max(Math.min(lo1, hi1), Math.min(lo2, hi2)));
  if (horizontal(a, b) && horizontal(c, d) && Math.abs(a.y - c.y) < EPSILON) return shared(a.x, b.x, c.x, d.x);
  if (vertical(a, b) && vertical(c, d) && Math.abs(a.x - c.x) < EPSILON) return shared(a.y, b.y, c.y, d.y);
  return 0;
}

const SWIMLANES = templates.filter((template) => template.category === "Process" && template.orientable);

describe("swimlane loop-backs", () => {
  it("are checked on at least the two swimlane templates", () => {
    expect(SWIMLANES.map((template) => template.id)).toEqual(expect.arrayContaining(["cross-functional", "incident-escalation"]));
  });

  for (const template of SWIMLANES) {
    for (const orientation of ["vertical", "horizontal"] as const) {
      describe(`${template.name}, ${orientation}`, () => {
        const section = template.build({ orientation }).sections[0];
        const edges = section.edges ?? [];
        const rects = absoluteRects(section.nodes);
        const shifts = parallelShifts(edges);
        const drawn = new Map(edges.map((edge) => [edge.id, draw(edge, rects, shifts)]));
        const blocks = section.nodes.filter((node) => node.type === "block");
        const loops = edges.filter((edge) => edge.style === "dashed");

        it("has loop-backs to check", () => expect(loops.length).toBeGreaterThan(0));

        for (const loop of loops) {
          const { segments } = drawn.get(loop.id)!;

          it(`"${loop.label}" doesn't cut through a step`, () => {
            const cut = blocks.filter(
              (block) =>
                block.id !== loop.source &&
                block.id !== loop.target &&
                segments.some((segment) => cutsThrough(segment, rects.get(block.id)!)),
            );
            expect(cut.map((block) => block.data.label)).toEqual([]);
          });

          it(`"${loop.label}" doesn't run along another line`, () => {
            const along = edges.filter(
              (other) =>
                other.id !== loop.id &&
                segments.some((mine) => drawn.get(other.id)!.segments.some((theirs) => overlap(mine, theirs) > 2)),
            );
            expect(along.map((other) => other.label)).toEqual([]);
          });
        }
      });
    }
  }
});
