import { DEFAULT_LEGEND } from "../../src/lib/diagram/defaultLegend";
import { CONTAINER_HEADER, CONTAINER_PADDING, LAYOUT_GAP } from "../../src/lib/diagram/layout";
import type { Diagram, DiagramEdge, DiagramNode, DiagramSection } from "../../src/lib/diagram/types";

/**
 * Large, realistic diagrams for performance tests. Deterministic: the same options always give the same
 * diagram (ids, names and layout), so runs can be compared. Relative imports, so Playwright can load it too.
 */
export interface StressOptions {
  /** Components on each tab, spread over containers. */
  componentsPerTab: number;
  /** Tabs; each later tab is the first with a few renames, removals and additions, as in current vs target. */
  tabs?: number;
  /** Components per container. */
  perContainer?: number;
  /** Every n-th component gets an internal design (L2); 0 for none. */
  detailEvery?: number;
  /** Nodes in each internal design. */
  detailSize?: number;
}

const BLOCK = { width: 140, height: 56 };
const COLUMNS = 5;
const CONTAINERS_PER_ROW = 6;
const TECHNOLOGIES = ["Java", "Node.js", "Go", "PostgreSQL", "Redis", "Kafka", "React", "Python"];
const OWNERS = ["Payments", "Platform", "Identity", "Data", "Mobile", "Growth"];
const PROTOCOLS = ["REST", "gRPC", "Kafka", "JDBC", "GraphQL"];
const NAMES = ["Orders", "Billing", "Catalog", "Search", "Accounts", "Shipping", "Pricing", "Inventory", "Reviews", "Ledger"];

/** Containers of components laid out in a grid, with connections along each container and across them. */
function buildNodes(prefix: string, count: number, perContainer: number, detailEvery: number, detailSize: number) {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const rows = Math.ceil(perContainer / COLUMNS);
  const container = {
    width: CONTAINER_PADDING * 2 + COLUMNS * BLOCK.width + (COLUMNS - 1) * LAYOUT_GAP,
    height: CONTAINER_HEADER + CONTAINER_PADDING + rows * BLOCK.height + (rows - 1) * LAYOUT_GAP,
  };
  const containerCount = Math.ceil(count / perContainer);
  for (let c = 0; c < containerCount; c++) {
    const containerId = `${prefix}c${c}`;
    nodes.push({
      id: containerId,
      type: "container",
      position: { x: (c % CONTAINERS_PER_ROW) * (container.width + 80), y: Math.floor(c / CONTAINERS_PER_ROW) * (container.height + 80) },
      size: container,
      data: { kind: "container", label: `Domain ${c + 1}`, colorKey: DEFAULT_LEGEND[c % DEFAULT_LEGEND.length].key },
    });
    for (let i = 0; i < perContainer && c * perContainer + i < count; i++) {
      const n = c * perContainer + i;
      const id = `${prefix}b${n}`;
      nodes.push({
        id,
        type: "block",
        parentId: containerId,
        position: {
          x: CONTAINER_PADDING + (i % COLUMNS) * (BLOCK.width + LAYOUT_GAP),
          y: CONTAINER_HEADER + Math.floor(i / COLUMNS) * (BLOCK.height + LAYOUT_GAP),
        },
        size: BLOCK,
        data: {
          kind: "block",
          label: `${NAMES[n % NAMES.length]} ${n}`,
          colorKey: DEFAULT_LEGEND[n % DEFAULT_LEGEND.length].key,
          containerId,
          technology: TECHNOLOGIES[n % TECHNOLOGIES.length],
          owner: OWNERS[n % OWNERS.length],
          description: `Handles ${NAMES[n % NAMES.length].toLowerCase()} for domain ${c + 1}.`,
          ...(detailEvery && n % detailEvery === 0 ? { detail: buildDetail(`${id}-`, detailSize) } : {}),
        },
      });
      // Along the container, and every third component also calls one in the next container.
      if (i > 0) edges.push(edge(`${prefix}e${n}`, `${prefix}b${n - 1}`, id, n));
      if (n % 3 === 0 && n + perContainer < count) edges.push(edge(`${prefix}x${n}`, id, `${prefix}b${n + perContainer}`, n));
    }
  }
  return { nodes, edges };
}

function edge(id: string, source: string, target: string, n: number): DiagramEdge {
  return {
    id,
    source,
    target,
    label: NAMES[(n + 3) % NAMES.length],
    protocol: PROTOCOLS[n % PROTOCOLS.length],
    ...(n % 4 === 0 ? { style: "dashed" as const } : {}),
  };
}

function buildDetail(prefix: string, size: number) {
  const { nodes, edges } = buildNodes(prefix, size, Math.max(1, Math.min(size, 10)), 0, 0);
  // Internal designs are one level deep and can't carry their own.
  return { nodes, edges };
}

/** A later tab: the first one with every 20th component renamed, every 25th removed, and a few added. */
function variant(first: DiagramSection, t: number): DiagramSection {
  const removed = new Set(
    first.nodes.filter((node, index) => node.type === "block" && index % 25 === 0).map((node) => node.id),
  );
  const rename = (id: string) => `t${t}-${id}`;
  const nodes = first.nodes
    .filter((node) => !removed.has(node.id))
    .map((node, index) => ({
      ...node,
      id: rename(node.id),
      parentId: node.parentId ? rename(node.parentId) : undefined,
      data:
        node.data.kind === "block"
          ? {
              ...node.data,
              containerId: node.data.containerId ? rename(node.data.containerId) : null,
              label: index % 20 === 0 ? `${node.data.label} v2` : node.data.label,
            }
          : node.data,
    }));
  const edges = (first.edges ?? [])
    .filter((candidate) => !removed.has(candidate.source) && !removed.has(candidate.target))
    .map((candidate) => ({ ...candidate, id: rename(candidate.id), source: rename(candidate.source), target: rename(candidate.target) }));
  const added = buildNodes(`t${t}-new-`, Math.max(1, Math.floor(first.nodes.length / 50)), 10, 0, 0);
  const offsetY = Math.max(...nodes.map((node) => node.position.y + node.size.height)) + 160;
  return {
    id: `tab${t}`,
    name: `Tab ${t + 1}`,
    nodes: [
      ...nodes,
      ...added.nodes.map((node) => (node.parentId ? node : { ...node, position: { x: node.position.x, y: node.position.y + offsetY } })),
    ],
    edges: [...edges, ...added.edges],
  };
}

export function stressDiagram({
  componentsPerTab,
  tabs = 4,
  perContainer = 20,
  detailEvery = 10,
  detailSize = 10,
}: StressOptions): Diagram {
  const { nodes, edges } = buildNodes("", componentsPerTab, perContainer, detailEvery, detailSize);
  const first: DiagramSection = { id: "tab0", name: "Tab 1", nodes, edges };
  const sections = [first, ...Array.from({ length: tabs - 1 }, (_, index) => variant(first, index + 1))];
  const stamp = "2026-01-01T00:00:00.000Z";
  return {
    schemaVersion: 1,
    id: `stress-${componentsPerTab}`,
    name: `Stress ${componentsPerTab}`,
    legend: DEFAULT_LEGEND.map((entry) => ({ ...entry })),
    sections,
    activeSectionId: first.id,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** Totals for reporting: what the diagram actually contains. */
export function stressStats(diagram: Diagram) {
  let nodes = 0;
  let edges = 0;
  let details = 0;
  for (const section of diagram.sections) {
    nodes += section.nodes.length;
    edges += section.edges?.length ?? 0;
    for (const node of section.nodes) {
      if (node.data.kind !== "block" || !node.data.detail) continue;
      details += 1;
      nodes += node.data.detail.nodes.length;
      edges += node.data.detail.edges?.length ?? 0;
    }
  }
  return { tabs: diagram.sections.length, nodes, edges, details, bytes: JSON.stringify(diagram).length };
}
