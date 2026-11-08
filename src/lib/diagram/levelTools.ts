import { createId } from "./factory";
import { CONTAINER_HEADER, CONTAINER_MIN, CONTAINER_PADDING, LAYOUT_GAP } from "./layout";
import type { BlockColorKey, Diagram, DiagramEdge, DiagramNode, DiagramSection, LegendEntry } from "./types";

/* ---------------------------------------------------------------- L0: landscape summary */

export interface CategoryCount {
  /** Undefined for components and containers with no category. */
  key?: BlockColorKey;
  label: string;
  color?: string;
  /** Ids of the components and containers in this category, in canvas order. */
  ids: string[];
}

export interface LandscapeSummary {
  containers: number;
  components: number;
  connections: number;
  /** Legend order, then "No category"; categories nobody uses are left out. */
  categories: CategoryCount[];
}

/** What a canvas holds, by kind and by legend category. Text boxes aren't part of the landscape. */
export function landscapeSummary(view: Pick<DiagramSection, "nodes" | "edges">, legend: LegendEntry[]): LandscapeSummary {
  const boxes = view.nodes.filter((node) => node.type !== "text");
  const byKey = new Map<string | undefined, string[]>();
  for (const node of boxes) {
    const key = legend.some((entry) => entry.key === node.data.colorKey) ? node.data.colorKey : undefined;
    byKey.set(key, [...(byKey.get(key) ?? []), node.id]);
  }
  const categories: CategoryCount[] = legend
    .filter((entry) => byKey.has(entry.key))
    .map((entry) => ({ key: entry.key, label: entry.label || "Unnamed category", color: entry.color, ids: byKey.get(entry.key)! }));
  const none = byKey.get(undefined);
  if (none) categories.push({ label: "No category", ids: none });
  return {
    containers: boxes.filter((node) => node.type === "container").length,
    components: boxes.filter((node) => node.type === "block").length,
    connections: view.edges?.length ?? 0,
    categories,
  };
}

/* ---------------------------------------------------------------- L1: what flows and how */

/** Protocols architects reach for most, offered before anything has been typed in this diagram. */
export const COMMON_PROTOCOLS = [
  "REST",
  "HTTPS",
  "gRPC",
  "GraphQL",
  "SOAP",
  "WebSocket",
  "Kafka",
  "AMQP",
  "MQTT",
  "SQS",
  "SNS",
  "JDBC",
  "SQL",
  "SFTP",
  "Batch file",
  "SMTP",
];

/** Protocols that are asynchronous by nature, so their lines are usually dashed. */
const ASYNC_PROTOCOL = /\b(kafka|amqp|mqtt|sqs|sns|rabbit\w*|jms|mq|pub\/?sub|event\w*|queue\w*|topic\w*|stream\w*|webhook\w*|batch|sftp|ftp|smtp|email)\b/i;

export function isAsyncProtocol(protocol: string | undefined): boolean {
  return !!protocol && ASYNC_PROTOCOL.test(protocol);
}

function everyEdge(diagram: Diagram): DiagramEdge[] {
  return diagram.sections.flatMap((section) => [
    ...(section.edges ?? []),
    ...section.nodes.flatMap((node) => (node.data.kind === "block" ? (node.data.detail?.edges ?? []) : [])),
  ]);
}

/** Distinct values, most used first, then alphabetical; case-insensitive, keeping the first spelling seen. */
function byUse(values: (string | undefined)[]): string[] {
  const counts = new Map<string, { value: string; count: number }>();
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    const seen = counts.get(key);
    counts.set(key, { value: seen?.value ?? value, count: (seen?.count ?? 0) + 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .map((entry) => entry.value);
}

/**
 * Values to offer while typing a connection's "What flows" and "Protocol": what this diagram already uses (so the
 * same thing is spelled the same way everywhere), then common protocols not used yet.
 */
export function connectionSuggestions(diagram: Diagram): { labels: string[]; protocols: string[] } {
  const edges = everyEdge(diagram);
  const used = byUse(edges.map((edge) => edge.protocol));
  const usedKeys = new Set(used.map((value) => value.toLowerCase()));
  return {
    labels: byUse(edges.map((edge) => edge.label)),
    protocols: [...used, ...COMMON_PROTOCOLS.filter((value) => !usedKeys.has(value.toLowerCase()))],
  };
}

/**
 * One-tap protocols for a connection: what the diagram uses most, then common ones, leaving out the one it already
 * has. A short list, so it fits under the field on a phone.
 */
export function protocolChips(diagram: Diagram, current: string | undefined, max = 6): string[] {
  const have = current?.trim().toLowerCase();
  return connectionSuggestions(diagram)
    .protocols.filter((value) => value.toLowerCase() !== have)
    .slice(0, max);
}

/**
 * The protocol a new connection on this canvas starts with: the newest connection's that has one. Connections on a
 * canvas tend to come in runs (all REST between services, all Kafka off the broker), so this saves retyping.
 */
export function lastProtocol(edges: DiagramEdge[] | undefined): string | undefined {
  return edges?.findLast((edge) => edge.protocol?.trim())?.protocol;
}

/* ---------------------------------------------------------------- L2: context from the level above */

export interface L1Neighbour {
  /** The component or container at the other end, on the tab. */
  node: DiagramNode;
  edges: DiagramEdge[];
  /** Already drawn in the internal design: something there has the same name. */
  present: boolean;
}

/** The name the context container gets, so it can be found again. */
export const L1_CONTEXT_LABEL = "Connected at L1";

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** What `component` connects to on its tab, one row per neighbour, and whether the design already shows it. */
export function l1Neighbours(section: DiagramSection, component: DiagramNode, design: DiagramNode[]): L1Neighbour[] {
  const rows = new Map<string, L1Neighbour>();
  for (const edge of section.edges ?? []) {
    const otherId = edge.source === component.id ? edge.target : edge.target === component.id ? edge.source : null;
    if (!otherId || otherId === component.id) continue;
    const node = section.nodes.find((candidate) => candidate.id === otherId);
    if (!node) continue;
    const row = rows.get(otherId);
    if (row) row.edges.push(edge);
    else {
      const present = design.some((candidate) => candidate.type !== "text" && sameName(candidate.data.label, node.data.label));
      rows.set(otherId, { node, edges: [edge], present });
    }
  }
  return [...rows.values()];
}

const STUB_SIZE = { width: 160, height: 56 };

/**
 * Adds the neighbours an internal design doesn't show yet as components in a dashed "Connected at L1" container,
 * to the right of what's drawn, so the inside can be connected to the outside. They keep their name, category,
 * technology, icon and shape, and say where they come from. Reuses the container if one is already there.
 */
export function withL1Context(design: DiagramNode[], neighbours: L1Neighbour[]): { nodes: DiagramNode[]; added: string[] } {
  const missing = neighbours.filter((row) => !row.present);
  if (!missing.length) return { nodes: design, added: [] };

  const existing = design.find((node) => node.type === "container" && !node.parentId && sameName(node.data.label, L1_CONTEXT_LABEL));
  const containerId = existing?.id ?? createId("container");
  const already = existing ? design.filter((node) => node.parentId === existing.id) : [];
  const firstRow = already.length
    ? Math.max(...already.map((node) => node.position.y + node.size.height)) + LAYOUT_GAP
    : CONTAINER_HEADER;

  const stubs: DiagramNode[] = missing.map((row, index) => {
    const source = row.node.data;
    return {
      id: createId("block"),
      type: "block",
      position: { x: CONTAINER_PADDING, y: firstRow + index * (STUB_SIZE.height + LAYOUT_GAP) },
      size: { ...STUB_SIZE },
      parentId: containerId,
      data: {
        kind: "block",
        label: source.label,
        containerId,
        ...(source.colorKey ? { colorKey: source.colorKey } : {}),
        ...(source.technology ? { technology: source.technology } : {}),
        ...(source.kind === "block" && source.icon ? { icon: source.icon } : {}),
        ...(source.kind === "block" && source.shape ? { shape: source.shape } : {}),
        description: `Outside this component: connected to it at L1.`,
      },
    };
  });

  const bottom = Math.max(CONTAINER_MIN.height, ...stubs.map((node) => node.position.y + node.size.height + CONTAINER_PADDING));
  const width = Math.max(CONTAINER_MIN.width, STUB_SIZE.width + CONTAINER_PADDING * 2);
  let nodes: DiagramNode[];
  if (existing) {
    nodes = design.map((node) =>
      node.id === existing.id
        ? { ...node, size: { width: Math.max(node.size.width, width), height: Math.max(node.size.height, bottom) } }
        : node,
    );
  } else {
    const topLevel = design.filter((node) => !node.parentId);
    const right = topLevel.length ? Math.max(...topLevel.map((node) => node.position.x + node.size.width)) + 120 : 0;
    const top = topLevel.length ? Math.min(...topLevel.map((node) => node.position.y)) : 0;
    const container: DiagramNode = {
      id: containerId,
      type: "container",
      position: { x: right, y: top },
      size: { width, height: bottom },
      data: { kind: "container", label: L1_CONTEXT_LABEL, outlineStyle: "dashed", description: "What this component talks to at L1." },
    };
    nodes = [...design, container];
  }
  return { nodes: [...nodes, ...stubs], added: stubs.map((node) => node.id) };
}
