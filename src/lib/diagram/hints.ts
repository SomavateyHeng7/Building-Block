import { isSequenceSection } from "./factory";
import type { Diagram, DiagramEdge, DiagramNode, ReviewComment } from "./types";

/**
 * Things worth a second look before a diagram goes into a review deck. Hints, not errors: nothing here stops
 * anyone saving or exporting. Checked on every architecture tab and every component's internal design.
 */
export type HintKind = "unconnected" | "no-protocol" | "no-owner" | "open-comment";

export interface Hint {
  kind: HintKind;
  /** What the hint is about: a component id, or a connection id. */
  id: string;
  target: "node" | "edge";
  sectionId: string;
  /** Set when it is inside this component's internal design. */
  detailId?: string;
  /** The component's name, or "Orders → Billing" for a connection. */
  label: string;
  /** Where it is: "Current", or "Current › Orders" inside an internal design. */
  where: string;
  message: string;
}

export const HINT_TITLES: Record<HintKind, string> = {
  unconnected: "Components with no connections",
  "no-protocol": "Connections with no protocol",
  "no-owner": "Components with no owner",
  "open-comment": "Open review comments",
};

export const HINT_ORDER: HintKind[] = ["open-comment", "unconnected", "no-protocol", "no-owner"];

function blank(value: string | undefined): boolean {
  return !value?.trim();
}

/** One canvas: a tab's, or a component's internal design. */
function hintsFor(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  place: { sectionId: string; detailId?: string; where: string },
  comments: ReviewComment[] = [],
): Hint[] {
  const names = new Map(nodes.map((node) => [node.id, node.data.label || "Untitled"]));
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const hints: Hint[] = [];
  for (const node of nodes) {
    if (node.data.kind !== "block") continue;
    const label = names.get(node.id)!;
    // A canvas with no connections at all hasn't reached L1 yet, so every component being alone isn't news.
    if (edges.length && !connected.has(node.id)) {
      hints.push({ kind: "unconnected", id: node.id, target: "node", ...place, label, message: "Nothing is connected to it." });
    }
    // Owners are recorded against L0 components; an internal design belongs to its parent's owner.
    if (!place.detailId && blank(node.data.owner)) {
      hints.push({ kind: "no-owner", id: node.id, target: "node", ...place, label, message: "No owner recorded." });
    }
  }
  for (const edge of edges) {
    if (!blank(edge.protocol)) continue;
    const label = `${names.get(edge.source) ?? "?"} → ${names.get(edge.target) ?? "?"}`;
    hints.push({ kind: "no-protocol", id: edge.id, target: "edge", ...place, label, message: "No protocol (REST, Kafka…)." });
  }
  for (const comment of comments) {
    if (comment.resolved) continue;
    const node = nodes.find((candidate) => candidate.id === comment.targetId);
    const edge = edges.find((candidate) => candidate.id === comment.targetId);
    if (!node && !edge) continue;
    const label = node ? names.get(node.id)! : `${names.get(edge!.source) ?? "?"} → ${names.get(edge!.target) ?? "?"}`;
    const excerpt = comment.text.length > 80 ? `${comment.text.slice(0, 80)}…` : comment.text;
    hints.push({ kind: "open-comment", id: comment.targetId, target: node ? "node" : "edge", ...place, label, message: `${comment.author}: ${excerpt}` });
  }
  return hints;
}

export function diagramHints(diagram: Pick<Diagram, "sections" | "comments">): Hint[] {
  return diagram.sections.flatMap((section) => {
    if (isSequenceSection(section)) return [];
    const top = hintsFor(section.nodes, section.edges ?? [], { sectionId: section.id, where: section.name }, diagram.comments);
    const inside = section.nodes.flatMap((node) =>
      node.data.kind === "block" && node.data.detail?.nodes.length
        ? hintsFor(node.data.detail.nodes, node.data.detail.edges ?? [], {
            sectionId: section.id,
            detailId: node.id,
            where: `${section.name} › ${node.data.label}`,
          }, diagram.comments)
        : [],
    );
    return [...top, ...inside];
  });
}
