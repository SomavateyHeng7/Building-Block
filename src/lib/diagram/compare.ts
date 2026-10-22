import { componentIcon } from "./componentIcons";
import type { Diagram, DiagramEdge, DiagramNode, DiagramSection } from "./types";

/**
 * Comparing two tabs, e.g. "Current" and "Target": what was added, removed or changed between them.
 *
 * Things are matched by **name**, not id: a duplicated tab gets fresh ids, and to an architect "Billing" on
 * both tabs is the same system. Position and size are ignored, since moving a box isn't an architecture change.
 */

export type ChangeKind = "added" | "removed" | "changed";

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export interface NodeChange {
  kind: ChangeKind;
  type: "container" | "component";
  label: string;
  /** The node's id on the tab it can be found on: the "to" tab, or the "from" tab when removed. */
  id: string;
  sectionId: string;
  /** Empty unless `kind` is "changed". */
  fields: FieldChange[];
}

export interface ConnectionChange {
  kind: ChangeKind;
  from: string;
  to: string;
  /** What flows, on the newer side when there is one. */
  label: string;
  id: string;
  sectionId: string;
  fields: FieldChange[];
}

export interface SectionComparison {
  nodes: NodeChange[];
  connections: ConnectionChange[];
  /** Things on both tabs with nothing changed. */
  unchanged: number;
}

const normalize = (value: string | undefined) => (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Pairs items from two lists that share a key, in order (the first "API" with the first "API"), and returns
 * the pairs plus what's left on each side. Items whose key is the same appear once per list in real diagrams;
 * pairing in order keeps a repeated name from matching twice.
 */
function pairBy<T>(before: T[], after: T[], key: (item: T) => string) {
  const waiting = new Map<string, T[]>();
  for (const item of before) {
    const list = waiting.get(key(item)) ?? [];
    list.push(item);
    waiting.set(key(item), list);
  }
  const pairs: [T, T][] = [];
  const added: T[] = [];
  for (const item of after) {
    const match = waiting.get(key(item))?.shift();
    if (match) pairs.push([match, item]);
    else added.push(item);
  }
  const removed = before.filter((item) => !pairs.some(([match]) => match === item));
  return { pairs, added, removed };
}

function fieldChanges(fields: [string, string, string][]): FieldChange[] {
  return fields
    .filter(([, before, after]) => before.trim() !== after.trim())
    .map(([field, before, after]) => ({ field, before, after }));
}

/** "3 items, 2 connections", or "None". */
function describeDetail(node: DiagramNode): string {
  const detail = node.data.kind === "block" ? node.data.detail : undefined;
  if (!detail?.nodes.length) return "None";
  const items = `${detail.nodes.length} item${detail.nodes.length === 1 ? "" : "s"}`;
  const edges = detail.edges?.length ?? 0;
  return edges ? `${items}, ${edges} connection${edges === 1 ? "" : "s"}` : items;
}

/** What an internal design contains, by name, so two designs can be compared without their ids. */
function detailSignature(node: DiagramNode): string {
  const detail = node.data.kind === "block" ? node.data.detail : undefined;
  if (!detail) return "";
  const labelOf = new Map(detail.nodes.map((child) => [child.id, normalize(child.data.label)]));
  const nodes = detail.nodes.map((child) =>
    [child.type, normalize(child.data.label), labelOf.get(child.parentId ?? "") ?? "", child.data.colorKey ?? ""].join("|"),
  );
  const edges = (detail.edges ?? []).map((edge) =>
    [labelOf.get(edge.source), labelOf.get(edge.target), normalize(edge.label), normalize(edge.protocol)].join("|"),
  );
  return JSON.stringify([nodes.sort(), edges.sort()]);
}

const DIRECTIONS = { forward: "One way", both: "Both ways", none: "No arrow" };

/** Which tab is "from" and which is "to" decides what counts as added and removed. */
export function compareSections(diagram: Diagram, from: DiagramSection, to: DiagramSection): SectionComparison {
  const category = (node: DiagramNode) =>
    diagram.legend.find((entry) => entry.key === node.data.colorKey)?.label ?? "";
  const iconLabel = (node: DiagramNode) => (node.data.kind === "block" ? (componentIcon(node.data.icon)?.label ?? "") : "");
  const containerOf = (section: DiagramSection) => (node: DiagramNode) =>
    section.nodes.find((candidate) => candidate.id === node.parentId)?.data.label ?? "";
  const fromContainer = containerOf(from);
  const toContainer = containerOf(to);

  const nodes: NodeChange[] = [];
  let unchanged = 0;

  for (const type of ["container", "block"] as const) {
    const { pairs, added, removed } = pairBy(
      from.nodes.filter((node) => node.type === type),
      to.nodes.filter((node) => node.type === type),
      (node) => normalize(node.data.label),
    );
    const kind = type === "block" ? "component" : "container";
    for (const node of added) {
      nodes.push({ kind: "added", type: kind, label: node.data.label, id: node.id, sectionId: to.id, fields: [] });
    }
    for (const node of removed) {
      nodes.push({ kind: "removed", type: kind, label: node.data.label, id: node.id, sectionId: from.id, fields: [] });
    }
    for (const [before, after] of pairs) {
      const fields = fieldChanges([
        ["Category", category(before), category(after)],
        ...(type === "block" ? [["Container", fromContainer(before), toContainer(after)] as [string, string, string]] : []),
        ...(type === "block" ? [["Icon", iconLabel(before), iconLabel(after)] as [string, string, string]] : []),
        ["Technology", before.data.technology ?? "", after.data.technology ?? ""],
        ["Owner", before.data.owner ?? "", after.data.owner ?? ""],
        ["Description", before.data.description ?? "", after.data.description ?? ""],
        ["Notes", before.data.notes ?? "", after.data.notes ?? ""],
      ]);
      if (type === "block" && detailSignature(before) !== detailSignature(after)) {
        const beforeDetail = describeDetail(before);
        const afterDetail = describeDetail(after);
        fields.push({
          field: "Internal design",
          before: beforeDetail,
          after: afterDetail === beforeDetail ? `${afterDetail} (changed)` : afterDetail,
        });
      }
      if (fields.length) {
        nodes.push({ kind: "changed", type: kind, label: after.data.label, id: after.id, sectionId: to.id, fields });
      } else {
        unchanged += 1;
      }
    }
  }

  const connections = compareConnections(from, to);
  unchanged += connections.unchanged;
  return { nodes, connections: connections.changes, unchanged };
}

function compareConnections(from: DiagramSection, to: DiagramSection) {
  const describe = (section: DiagramSection) => (edge: DiagramEdge) => {
    const nameOf = (id: string) => section.nodes.find((node) => node.id === id)?.data.label ?? "";
    let source = nameOf(edge.source);
    let target = nameOf(edge.target);
    // Without a single direction, A–B and B–A are the same line.
    if ((edge.direction ?? "forward") !== "forward" && normalize(source) > normalize(target)) {
      [source, target] = [target, source];
    }
    return { edge, source, target, ends: `${normalize(source)}→${normalize(target)}` };
  };
  type Described = ReturnType<ReturnType<typeof describe>>;
  const before = (from.edges ?? []).map(describe(from));
  const after = (to.edges ?? []).map(describe(to));

  // Same ends and same "what flows" first; then whatever is left between the same ends is a change of label.
  const exact = pairBy(before, after, (item) => `${item.ends}|${normalize(item.edge.label)}`);
  const loose = pairBy(exact.removed, exact.added, (item) => item.ends);

  const changes: ConnectionChange[] = [];
  let unchanged = 0;
  const entry = (kind: ChangeKind, item: Described, sectionId: string, fields: FieldChange[] = []): ConnectionChange => ({
    kind,
    from: item.source,
    to: item.target,
    label: item.edge.label ?? "",
    id: item.edge.id,
    sectionId,
    fields,
  });

  for (const item of loose.added) changes.push(entry("added", item, to.id));
  for (const item of loose.removed) changes.push(entry("removed", item, from.id));
  for (const [old, current] of [...exact.pairs, ...loose.pairs]) {
    const fields = fieldChanges([
      ["What flows", old.edge.label ?? "", current.edge.label ?? ""],
      ["Protocol", old.edge.protocol ?? "", current.edge.protocol ?? ""],
      ["Direction", DIRECTIONS[old.edge.direction ?? "forward"], DIRECTIONS[current.edge.direction ?? "forward"]],
      ["Line", old.edge.style === "dashed" ? "Dashed" : "Solid", current.edge.style === "dashed" ? "Dashed" : "Solid"],
      ["Description", old.edge.description ?? "", current.edge.description ?? ""],
    ]);
    if (fields.length) changes.push(entry("changed", current, to.id, fields));
    else unchanged += 1;
  }
  return { changes, unchanged };
}

export function countChanges(comparison: SectionComparison): Record<ChangeKind, number> {
  const counts = { added: 0, removed: 0, changed: 0 };
  for (const change of [...comparison.nodes, ...comparison.connections]) counts[change.kind] += 1;
  return counts;
}

const KIND_LABEL: Record<ChangeKind, string> = { added: "Added", removed: "Removed", changed: "Changed" };

/** The comparison as a change list for the solution document: one row per change, or per changed field. */
export function comparisonRows(comparison: SectionComparison): string[][] {
  const rows: string[][] = [["Change", "Type", "Name", "What changed", "Before", "After"]];
  for (const change of comparison.nodes) {
    const type = change.type === "container" ? "Container" : "Component";
    if (change.kind !== "changed") rows.push([KIND_LABEL[change.kind], type, change.label, "", "", ""]);
    for (const field of change.fields) {
      rows.push([KIND_LABEL[change.kind], type, change.label, field.field, field.before, field.after]);
    }
  }
  for (const change of comparison.connections) {
    const name = connectionName(change);
    if (change.kind !== "changed") rows.push([KIND_LABEL[change.kind], "Connection", name, "", "", ""]);
    for (const field of change.fields) {
      rows.push([KIND_LABEL[change.kind], "Connection", name, field.field, field.before, field.after]);
    }
  }
  return rows;
}

/** The colours changes are marked in on the canvas and in its legend: green, amber and red, as in the change list. */
export const CHANGE_COLORS: Record<ChangeKind, string> = { added: "#16a34a", changed: "#d97706", removed: "#dc2626" };

/** Two tabs being compared on the canvas. Kept with the diagram's id, so opening another diagram drops it. */
export interface ComparePair {
  diagramId: string;
  fromId: string;
  toId: string;
}

/** What to mark on one view: each node's and connection's change, by id. */
export interface ChangeMarks {
  nodes: Map<string, ChangeKind>;
  edges: Map<string, ChangeKind>;
  /** Legend lines for the kinds that appear, e.g. "Added since Current". */
  legend: { key: string; label: string; color: string }[];
}

/**
 * The marks for the view on screen while a comparison is shown: added and changed things on the "to" tab,
 * removed ones on the "from" tab (they aren't on the other one). Null when nothing on this view is marked:
 * another tab, an internal design, or a comparison that no longer applies.
 */
export function changeMarksForView(
  diagram: Diagram,
  pair: ComparePair | null,
  view: { id: string; parent?: unknown },
): ChangeMarks | null {
  if (!pair || pair.diagramId !== diagram.id || view.parent || pair.fromId === pair.toId) return null;
  if (view.id !== pair.fromId && view.id !== pair.toId) return null;
  const from = diagram.sections.find((section) => section.id === pair.fromId);
  const to = diagram.sections.find((section) => section.id === pair.toId);
  if (!from || !to) return null;

  const comparison = compareSections(diagram, from, to);
  const here = <T extends { sectionId: string; id: string; kind: ChangeKind }>(changes: T[]) =>
    new Map(changes.filter((change) => change.sectionId === view.id).map((change) => [change.id, change.kind]));
  const nodes = here(comparison.nodes);
  const edges = here(comparison.connections);
  const kinds = new Set([...nodes.values(), ...edges.values()]);
  const caption: Record<ChangeKind, string> = {
    added: `Added since ${from.name}`,
    changed: `Changed since ${from.name}`,
    removed: `Removed in ${to.name}`,
  };
  const legend = (["added", "changed", "removed"] as const)
    .filter((kind) => kinds.has(kind))
    .map((kind) => ({ key: `change:${kind}`, label: caption[kind], color: CHANGE_COLORS[kind] }));
  return { nodes, edges, legend };
}

/** "Orders → Billing (Invoices)". */
export function connectionName(change: ConnectionChange): string {
  return `${change.from} → ${change.to}${change.label ? ` (${change.label})` : ""}`;
}
