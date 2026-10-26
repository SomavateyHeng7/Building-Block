import { componentIcon } from "./componentIcons";
import type { Diagram, DiagramEdge, DiagramNode, SequenceDiagram } from "./types";

/**
 * Finding things anywhere in a diagram: every tab, every component's internal design and every sequence. Matches
 * names first, then the other things an architect writes down (technology, owner, category, description, notes),
 * connections and messages by what flows, protocol and description, and notes on sequences by their text.
 */

export interface SearchResult {
  kind: "container" | "component" | "connection" | "participant" | "message" | "note";
  id: string;
  sectionId: string;
  /** Set when the result is inside this component's internal design. */
  detailId?: string;
  /** The name, "Orders → Billing" for a connection or message, or the start of a note. */
  label: string;
  /** Where it is: "Current", or "Current › Orders" inside an internal design. */
  where: string;
  /** What matched when it isn't the name, e.g. "Technology: Kafka". */
  match?: string;
}

const normalize = (value: string | undefined) => (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** Lower is better: the name starting with the query, then the name containing it, then any other field. */
function score(query: string, label: string, fields: [string, string | undefined][]): { score: number; match?: string } | null {
  const name = normalize(label);
  if (name.startsWith(query)) return { score: 0 };
  if (name.includes(query)) return { score: 1 };
  const field = fields.find(([, value]) => normalize(value).includes(query));
  return field ? { score: 2, match: `${field[0]}: ${field[1]}` } : null;
}

export function searchDiagram(diagram: Diagram, rawQuery: string, limit = 50): SearchResult[] {
  const query = normalize(rawQuery);
  if (!query) return [];
  const categories = new Map(diagram.legend.map((entry) => [entry.key, entry.label]));
  const results: { score: number; result: SearchResult }[] = [];

  function visit(nodes: DiagramNode[], edges: DiagramEdge[], sectionId: string, where: string, detailId?: string) {
    for (const node of nodes) {
      const icon = node.data.kind === "block" ? componentIcon(node.data.icon)?.label : undefined;
      const found = score(query, node.data.label, [
        ["Technology", node.data.technology],
        ["Owner", node.data.owner],
        ["Category", node.data.colorKey ? categories.get(node.data.colorKey) : undefined],
        ["Icon", icon],
        ["Description", node.data.description],
        ["Notes", node.data.notes],
      ]);
      if (found) {
        const kind = node.type === "container" ? "container" : "component";
        const result: SearchResult = { kind, id: node.id, sectionId, detailId, label: node.data.label, where };
        if (found.match) result.match = found.match;
        results.push({ score: found.score, result });
      }
    }
    const nameOf = (id: string) => nodes.find((node) => node.id === id)?.data.label ?? "?";
    for (const edge of edges) {
      const label = `${nameOf(edge.source)} → ${nameOf(edge.target)}`;
      // A connection is found by what it says, not by its ends' names: those find the components themselves.
      const field = (
        [
          ["What flows", edge.label],
          ["Protocol", edge.protocol],
          ["Description", edge.description],
        ] as [string, string | undefined][]
      ).find(([, value]) => normalize(value).includes(query));
      if (field) {
        const match = `${field[0]}: ${field[1]}`;
        results.push({ score: 2, result: { kind: "connection", id: edge.id, sectionId, detailId, label, where, match } });
      }
    }
  }

  function visitSequence(sequence: SequenceDiagram, sectionId: string, where: string) {
    const nameOf = (id: string) => sequence.participants.find((participant) => participant.id === id)?.label ?? "?";
    for (const participant of sequence.participants) {
      const found = score(query, participant.label, [
        ["Category", participant.colorKey ? categories.get(participant.colorKey) : undefined],
        ["Description", participant.description],
      ]);
      if (found) {
        const result: SearchResult = { kind: "participant", id: participant.id, sectionId, label: participant.label, where };
        if (found.match) result.match = found.match;
        results.push({ score: found.score, result });
      }
    }
    for (const step of sequence.steps) {
      if (step.type === "note") {
        if (!normalize(step.text).includes(query)) continue;
        const label = step.text.length > 60 ? `${step.text.slice(0, 57)}…` : step.text;
        results.push({ score: 2, result: { kind: "note", id: step.id, sectionId, label, where: `${where} › note over ${step.over.map(nameOf).join(", ")}` } });
        continue;
      }
      // Like connections: found by what they say; their ends' names find the participants.
      const field = (
        [
          ["What's sent", step.label],
          ["Protocol", step.protocol],
        ] as [string, string | undefined][]
      ).find(([, value]) => normalize(value).includes(query));
      if (field) {
        const label = `${nameOf(step.from)} → ${nameOf(step.to)}`;
        results.push({ score: 2, result: { kind: "message", id: step.id, sectionId, label, where, match: `${field[0]}: ${field[1]}` } });
      }
    }
  }

  for (const section of diagram.sections) {
    if (section.sequence) {
      visitSequence(section.sequence, section.id, section.name);
      continue;
    }
    visit(section.nodes, section.edges ?? [], section.id, section.name);
    for (const node of section.nodes) {
      if (node.data.kind === "block" && node.data.detail) {
        const { nodes, edges } = node.data.detail;
        visit(nodes, edges ?? [], section.id, `${section.name} › ${node.data.label}`, node.id);
      }
    }
  }

  // Stable: equal scores keep the diagram's order (tabs left to right, each tab before its internal designs).
  return results
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ result }) => result);
}
