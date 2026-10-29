import { isSequenceSection } from "./factory";
import { openCommentCount } from "./comments";
import type { Diagram, DiagramEdge, DiagramNode, DiagramSection } from "./types";

/**
 * What the canvas says out loud. A diagram is a picture, so a screen reader needs the same facts in words: what
 * is selected, where it sits, what it connects to, and what changed after a keystroke. These sentences feed the
 * editor's live region and the accessible names of nodes and connections.
 */

/** The state the announcer watches. */
export interface Watched {
  diagram: Diagram;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function section(diagram: Diagram): DiagramSection | undefined {
  return diagram.sections.find((candidate) => candidate.id === diagram.activeSectionId);
}

/** The nodes and connections on the canvas that is showing: the tab, or the open internal design. */
function canvas(diagram: Diagram): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const current = section(diagram);
  if (!current) return { nodes: [], edges: [] };
  if (diagram.activeDetailId) {
    const parent = current.nodes.find((node) => node.id === diagram.activeDetailId);
    if (parent?.data.kind === "block" && parent.data.detail) return { nodes: parent.data.detail.nodes, edges: parent.data.detail.edges ?? [] };
  }
  return { nodes: current.nodes, edges: current.edges ?? [] };
}

/** "Orders, component in Back office. Category: New. Technology: Java. 2 connections. 1 open comment." */
export function describeNode(diagram: Diagram, node: DiagramNode, nodes: DiagramNode[], edges: DiagramEdge[]): string {
  const parts = [node.data.label || "Untitled"];
  const kind = node.type === "container" ? "container" : "component";
  const parent = nodes.find((candidate) => candidate.id === node.parentId);
  parts[0] += `, ${kind}${parent ? ` in ${parent.data.label}` : ""}`;
  const category = node.data.colorKey ? diagram.legend.find((entry) => entry.key === node.data.colorKey)?.label : undefined;
  if (category) parts.push(`Category: ${category}`);
  if (node.data.technology) parts.push(`Technology: ${node.data.technology}`);
  if (node.data.owner) parts.push(`Owner: ${node.data.owner}`);
  const connected = edges.filter((edge) => edge.source === node.id || edge.target === node.id).length;
  if (node.type === "block") parts.push(plural(connected, "connection"));
  if (node.data.kind === "block" && node.data.detail?.nodes.length) parts.push(`Has an internal design with ${plural(node.data.detail.nodes.length, "item")}`);
  const open = openCommentCount(diagram.comments, node.id);
  if (open) parts.push(plural(open, "open comment"));
  return `${parts.join(". ")}.`;
}

/** "Connection from Web to API. What flows: Orders. Protocol: REST. Dashed." */
export function describeEdge(diagram: Diagram, edge: DiagramEdge, nodes: DiagramNode[]): string {
  const name = (id: string) => nodes.find((node) => node.id === id)?.data.label ?? "unknown";
  const direction = edge.direction ?? "forward";
  const parts = [`Connection ${direction === "both" ? "between" : "from"} ${name(edge.source)} ${direction === "both" ? "and" : "to"} ${name(edge.target)}`];
  if (edge.label) parts.push(`What flows: ${edge.label}`);
  if (edge.protocol) parts.push(`Protocol: ${edge.protocol}`);
  if (direction === "none") parts.push("No arrow");
  if (edge.style === "dashed") parts.push("Dashed");
  const open = openCommentCount(diagram.comments, edge.id);
  if (open) parts.push(plural(open, "open comment"));
  return `${parts.join(". ")}.`;
}

/** "Current. 12 components, 14 connections." for arriving on a tab or an internal design. */
export function describeView(diagram: Diagram): string {
  const current = section(diagram);
  if (!current) return "";
  if (isSequenceSection(current)) {
    const sequence = current.sequence;
    return `${current.name}, a sequence. ${plural(sequence?.participants.length ?? 0, "participant")}, ${plural(sequence?.steps.length ?? 0, "step")}.`;
  }
  const { nodes, edges } = canvas(diagram);
  const where = diagram.activeDetailId ? `Internal design of ${nodes.length ? (current.nodes.find((node) => node.id === diagram.activeDetailId)?.data.label ?? "") : ""}` : current.name;
  return `${where}. ${plural(nodes.filter((node) => node.type === "block").length, "component")}, ${plural(edges.length, "connection")}.`;
}

/**
 * The sentence to announce for a change from `prev` to `next`, or null when nothing worth saying happened
 * (moving a box, typing in a field). Selection and arriving on another view are the most useful, then
 * additions and removals.
 */
export function announceChange(prev: Watched, next: Watched): string | null {
  const before = { section: prev.diagram.activeSectionId, detail: prev.diagram.activeDetailId };
  const after = { section: next.diagram.activeSectionId, detail: next.diagram.activeDetailId };
  if (before.section !== after.section || before.detail !== after.detail) return describeView(next.diagram);

  const { nodes, edges } = canvas(next.diagram);
  const was = canvas(prev.diagram);

  const addedNodes = nodes.filter((node) => !was.nodes.some((old) => old.id === node.id));
  const removedNodes = was.nodes.filter((old) => !nodes.some((node) => node.id === old.id));
  const connectionDelta = edges.length - was.edges.length;
  if (addedNodes.length === 1 && !removedNodes.length) return `Added ${addedNodes[0].data.label || "Untitled"}. ${plural(nodes.length, "item")} here.`;
  if (addedNodes.length > 1) return `Added ${plural(addedNodes.length, "item")}. ${plural(nodes.length, "item")} here.`;
  if (removedNodes.length) return `Removed ${removedNodes.length === 1 ? removedNodes[0].data.label || "Untitled" : plural(removedNodes.length, "item")}. ${plural(nodes.length, "item")} left.`;
  if (connectionDelta > 0) return `Added ${plural(connectionDelta, "connection")}.`;
  if (connectionDelta < 0) return `Removed ${plural(-connectionDelta, "connection")}.`;

  if (next.selectedEdgeId && next.selectedEdgeId !== prev.selectedEdgeId) {
    const edge = edges.find((candidate) => candidate.id === next.selectedEdgeId);
    return edge ? describeEdge(next.diagram, edge, nodes) : null;
  }
  const same = prev.selectedNodeIds.length === next.selectedNodeIds.length && prev.selectedNodeIds.every((id, index) => id === next.selectedNodeIds[index]);
  if (!same) {
    if (next.selectedNodeIds.length === 1) {
      const node = nodes.find((candidate) => candidate.id === next.selectedNodeIds[0]);
      return node ? describeNode(next.diagram, node, nodes, edges) : null;
    }
    if (next.selectedNodeIds.length > 1) return `${plural(next.selectedNodeIds.length, "item")} selected.`;
    if (prev.selectedNodeIds.length || prev.selectedEdgeId) return "Selection cleared.";
  }
  return null;
}
