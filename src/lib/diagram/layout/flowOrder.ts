import { absolutePosition } from "./layout";
import type { DiagramEdge, DiagramNode } from "../types";

/**
 * Numbers every connection 1, 2, 3… in the order the flow reaches it, so a process diagram can be read in
 * sequence. Starts at the components nothing leads to (left-most first), follows the solid connections
 * breadth-first (a component's connections are numbered top to bottom by where they lead), and numbers the
 * dashed ones (the loop-backs and rework) last, so they never come before the step they loop back from.
 * Components in a cycle with no way in start from the left-most one. Returns a copy of every connection with
 * its `step` set.
 */
export function numberInFlowOrder(nodes: DiagramNode[], edges: DiagramEdge[]): DiagramEdge[] {
  const at = new Map(nodes.map((node) => [node.id, absolutePosition(node, nodes)]));
  const place = (id: string) => at.get(id) ?? { x: 0, y: 0 };
  const byPlace = (a: string, b: string) => place(a).x - place(b).x || place(a).y - place(b).y || a.localeCompare(b);

  const solid = edges.filter((edge) => edge.style !== "dashed");
  const hasIncoming = new Set(solid.map((edge) => edge.target));
  const connected = [...new Set(edges.flatMap((edge) => [edge.source, edge.target]))].sort(byPlace);

  const outgoing = new Map<string, DiagramEdge[]>();
  for (const edge of solid) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  for (const list of outgoing.values()) {
    list.sort((a, b) => place(a.target).y - place(b.target).y || byPlace(a.target, b.target));
  }

  const step = new Map<string, number>();
  const visitOrder: string[] = [];
  const seen = new Set<string>();
  let next = 1;

  const walk = (start: string) => {
    if (seen.has(start)) return;
    seen.add(start);
    visitOrder.push(start);
    const queue = [start];
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of outgoing.get(current) ?? []) {
        if (!step.has(edge.id)) step.set(edge.id, next++);
        if (!seen.has(edge.target)) {
          seen.add(edge.target);
          visitOrder.push(edge.target);
          queue.push(edge.target);
        }
      }
    }
  };

  for (const id of connected.filter((candidate) => !hasIncoming.has(candidate))) walk(id);
  // Whatever is left is only reachable round a cycle, or only through dashed connections.
  for (const id of connected) walk(id);

  const rank = new Map(visitOrder.map((id, index) => [id, index]));
  const rest = edges
    .filter((edge) => !step.has(edge.id))
    .sort((a, b) => (rank.get(a.source) ?? 0) - (rank.get(b.source) ?? 0) || byPlace(a.target, b.target));
  for (const edge of rest) step.set(edge.id, next++);

  return edges.map((edge) => ({ ...edge, step: step.get(edge.id)! }));
}
