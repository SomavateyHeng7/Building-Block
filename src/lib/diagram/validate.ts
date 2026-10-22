import { COMPONENT_ICON_KEYS } from "./componentIcons";
import { DEFAULT_LEGEND } from "./defaultLegend";
import { createBlankSection, createId } from "./factory";
import type {
  ConnectionSide,
  ContainerStyle,
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramSection,
  LegendEntry,
  NodeDetails,
} from "./types";

/** A file that can't be turned into a diagram at all; the message is shown to the user. */
export class DiagramFileError extends Error {}

export interface ParsedDiagram {
  diagram: Diagram;
  /** Human-readable notes about anything that had to be repaired or dropped. */
  fixes: string[];
}

const DEFAULT_SIZE = {
  container: { width: 320, height: 220 },
  block: { width: 160, height: 56 },
};
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SHORT_HEX_COLOR = /^#[0-9a-f]{3}$/i;
/** Bigger than any real diagram; larger values would stall rendering and export. */
const MAX_SIZE = 10_000;
const MAX_COORDINATE = 100_000;
const DETAIL_KEYS: (keyof NodeDetails)[] = ["technology", "owner", "description", "notes"];

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : undefined;
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

/** A colour the colour picker can show: #rrggbb, also accepting the short #rgb form. */
function hexColor(value: unknown): string | undefined {
  const color = text(value);
  if (color && HEX_COLOR.test(color)) return color;
  if (color && SHORT_HEX_COLOR.test(color)) return `#${[...color.slice(1)].map((digit) => digit + digit).join("")}`;
  return undefined;
}

function clamp(value: number, limit: number) {
  return Math.max(-limit, Math.min(limit, value));
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function parseLegend(raw: unknown, fixes: string[]): LegendEntry[] {
  if (!Array.isArray(raw)) {
    fixes.push("The legend was missing, so the default legend was used.");
    return DEFAULT_LEGEND.map((entry) => ({ ...entry }));
  }
  const seen = new Set<string>();
  const legend: LegendEntry[] = [];
  let dropped = 0;
  for (const item of raw) {
    const key = isObject(item) ? text(item.key) : undefined;
    const color = isObject(item) ? hexColor(item.color) : undefined;
    if (!isObject(item) || !key || seen.has(key) || !color) {
      dropped += 1;
      continue;
    }
    seen.add(key);
    legend.push({ key, label: text(item.label) ?? key, color });
  }
  if (dropped) fixes.push(`Skipped ${dropped} invalid legend ${dropped === 1 ? "entry" : "entries"}.`);
  return legend;
}

function parseContainerStyle(data: Raw): ContainerStyle {
  const style: ContainerStyle = {};
  const headerPosition = oneOf(data.headerPosition, ["top", "bottom", "left", "right"] as const);
  const headerAlign = oneOf(data.headerAlign, ["start", "center", "end"] as const);
  const outlineStyle = oneOf(data.outlineStyle, ["solid", "dashed"] as const);
  const outlineColor = hexColor(data.outlineColor);
  if (headerPosition) style.headerPosition = headerPosition;
  if (headerAlign) style.headerAlign = headerAlign;
  if (outlineStyle) style.outlineStyle = outlineStyle;
  if (outlineColor) style.outlineColor = outlineColor;
  return style;
}

/**
 * Returns null for a node that can't be used; `repaired` is set when defaults were filled in, and
 * `unknownIcon` when an icon this version doesn't have was dropped.
 */
function parseNode(
  raw: unknown,
  legendKeys: Set<string>,
): { node: DiagramNode; repaired: boolean; unknownIcon: boolean } | null {
  if (!isObject(raw)) return null;
  const id = text(raw.id);
  const type = oneOf(raw.type, ["container", "block"] as const);
  if (!id || !type) return null;

  const data = isObject(raw.data) ? raw.data : {};
  const position = isObject(raw.position) ? raw.position : {};
  const size = isObject(raw.size) ? raw.size : {};
  const width = finite(size.width);
  const height = finite(size.height);
  const x = finite(position.x);
  const y = finite(position.y);

  const details: NodeDetails = {};
  for (const key of DETAIL_KEYS) {
    const value = text(data[key])?.trim();
    if (value) details[key] = value;
  }
  const colorKey = text(data.colorKey);
  const icon = type === "block" ? oneOf(data.icon, COMPONENT_ICON_KEYS) : undefined;
  const unknownIcon = type === "block" && data.icon !== undefined && !icon;
  const label = text(data.label) ?? (type === "container" ? "Untitled Container" : "Untitled");
  const repaired =
    typeof data.label !== "string" ||
    x === undefined ||
    y === undefined ||
    Math.abs(x) > MAX_COORDINATE ||
    Math.abs(y) > MAX_COORDINATE ||
    !(width && width > 0 && width <= MAX_SIZE) ||
    !(height && height > 0 && height <= MAX_SIZE);

  const node: DiagramNode = {
    id,
    type,
    position: { x: clamp(x ?? 0, MAX_COORDINATE), y: clamp(y ?? 0, MAX_COORDINATE) },
    size: {
      width: width && width > 0 ? Math.min(width, MAX_SIZE) : DEFAULT_SIZE[type].width,
      height: height && height > 0 ? Math.min(height, MAX_SIZE) : DEFAULT_SIZE[type].height,
    },
    parentId: text(raw.parentId),
    zIndex: finite(raw.zIndex),
    data:
      type === "container"
        ? {
            kind: "container",
            label,
            ...details,
            ...parseContainerStyle(data),
            ...(colorKey && legendKeys.has(colorKey) ? { colorKey } : {}),
          }
        : {
            kind: "block",
            label,
            ...details,
            containerId: null,
            ...(colorKey && legendKeys.has(colorKey) ? { colorKey } : {}),
            ...(icon ? { icon } : {}),
          },
  };
  return { node, repaired, unknownIcon };
}

const SIDES = ["top", "right", "bottom", "left"] as const satisfies readonly ConnectionSide[];

/** Keeps connections between two different components or containers that exist; reports what was dropped. */
function parseEdges(raw: unknown, nodes: DiagramNode[], name: string, fixes: string[]): DiagramEdge[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    fixes.push(`"${name}": skipped connections that couldn't be read.`);
    return [];
  }
  const nodeIds = new Set(nodes.map((node) => node.id));
  const ids = new Set<string>();
  const edges: DiagramEdge[] = [];
  let dropped = 0;
  for (const item of raw) {
    const id = isObject(item) ? text(item.id) : undefined;
    const source = isObject(item) ? text(item.source) : undefined;
    const target = isObject(item) ? text(item.target) : undefined;
    if (!isObject(item) || !id || ids.has(id) || !source || !target || source === target || !nodeIds.has(source) || !nodeIds.has(target)) {
      dropped += 1;
      continue;
    }
    ids.add(id);
    const edge: DiagramEdge = { id, source, target };
    const sourceSide = oneOf(item.sourceSide, SIDES);
    const targetSide = oneOf(item.targetSide, SIDES);
    const direction = oneOf(item.direction, ["forward", "both", "none"] as const);
    const style = oneOf(item.style, ["solid", "dashed"] as const);
    const shape = oneOf(item.shape, ["step", "curved", "straight"] as const);
    const bend = isObject(item.bend) ? { x: finite(item.bend.x), y: finite(item.bend.y) } : undefined;
    if (sourceSide) edge.sourceSide = sourceSide;
    if (targetSide) edge.targetSide = targetSide;
    if (direction) edge.direction = direction;
    if (style) edge.style = style;
    if (shape) edge.shape = shape;
    if (bend?.x !== undefined && bend.y !== undefined && (bend.x || bend.y)) {
      edge.bend = { x: clamp(bend.x, MAX_COORDINATE), y: clamp(bend.y, MAX_COORDINATE) };
    }
    for (const key of ["label", "protocol", "description"] as const) {
      const value = text(item[key])?.trim();
      if (value) edge[key] = value;
    }
    edges.push(edge);
  }
  if (dropped) fixes.push(`"${name}": skipped ${plural(dropped, "connection")} that didn't join two different boxes.`);
  return edges;
}

function parseSection(raw: unknown, index: number, legendKeys: Set<string>, fixes: string[]): DiagramSection {
  const section = isObject(raw) ? raw : {};
  const name = text(section.name) || `Section ${index + 1}`;
  const { nodes, edges } = parseView(section.nodes, section.edges, name, legendKeys, fixes, 0);
  return { id: text(section.id) || createId("section"), name, nodes, ...(edges.length ? { edges } : {}) };
}

/**
 * The nodes and connections of one canvas: a tab (depth 0) or a component's internal design (depth 1).
 * `name` says where in the file a repair was made.
 */
function parseView(
  rawNodesInput: unknown,
  rawEdges: unknown,
  name: string,
  legendKeys: Set<string>,
  fixes: string[],
  depth: 0 | 1,
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const rawNodes = Array.isArray(rawNodesInput) ? rawNodesInput : [];
  const rawDetails = new Map<string, unknown>();
  const nodes: DiagramNode[] = [];
  const ids = new Set<string>();
  let unreadable = 0;
  let duplicates = 0;
  let repaired = 0;
  let unknownIcons = 0;
  for (const item of rawNodes) {
    const parsed = parseNode(item, legendKeys);
    if (!parsed) unreadable += 1;
    else if (ids.has(parsed.node.id)) duplicates += 1;
    else {
      ids.add(parsed.node.id);
      nodes.push(parsed.node);
      if (parsed.repaired) repaired += 1;
      if (parsed.unknownIcon) unknownIcons += 1;
      const rawDetail = isObject(item) && isObject(item.data) ? item.data.detail : undefined;
      if (parsed.node.type === "block" && rawDetail !== undefined) rawDetails.set(parsed.node.id, rawDetail);
    }
  }
  if (unreadable) fixes.push(`"${name}": skipped ${plural(unreadable, "item")} that couldn't be read.`);
  if (duplicates) fixes.push(`"${name}": skipped ${plural(duplicates, "duplicate item")}.`);
  if (repaired) {
    fixes.push(`"${name}": filled in or corrected a missing or out-of-range name, size or position for ${plural(repaired, "item")}.`);
  }
  if (unknownIcons) fixes.push(`"${name}": removed ${plural(unknownIcons, "icon")} this version doesn't have.`);

  // Only containers can hold components, and only one level deep.
  const containers = new Map(nodes.filter((node) => node.type === "container").map((node) => [node.id, node]));
  let detached = 0;
  const linked = nodes.map((node) => {
    if (!node.parentId) return node;
    const parent = node.type === "block" ? containers.get(node.parentId) : undefined;
    if (!parent) {
      detached += 1;
      // Keep it where it was on screen when the parent is known but not allowed.
      const known = nodes.find((candidate) => candidate.id === node.parentId);
      const position = known
        ? { x: node.position.x + known.position.x, y: node.position.y + known.position.y }
        : node.position;
      return { ...node, parentId: undefined, position };
    }
    return node.data.kind === "block" ? { ...node, data: { ...node.data, containerId: parent.id } } : node;
  });
  if (detached) {
    fixes.push(`"${name}": took ${plural(detached, "item")} out of a container that is missing or isn't a container.`);
  }

  const edges = parseEdges(rawEdges, linked, name, fixes);

  // Internal designs (L2) are one level deep.
  if (depth === 1) {
    if (rawDetails.size) {
      fixes.push(`"${name}": removed ${plural(rawDetails.size, "internal design")} nested inside an internal design.`);
    }
    return { nodes: linked, edges };
  }
  const withDetails = linked.map((node) => {
    const raw = rawDetails.get(node.id);
    if (raw === undefined || node.data.kind !== "block") return node;
    if (!isObject(raw)) {
      fixes.push(`"${name}": skipped the internal design of "${node.data.label}", which couldn't be read.`);
      return node;
    }
    const detail = parseView(raw.nodes, raw.edges, `${name} › ${node.data.label}`, legendKeys, fixes, 1);
    if (!detail.nodes.length) return node;
    return { ...node, data: { ...node.data, detail: { nodes: detail.nodes, ...(detail.edges.length ? { edges: detail.edges } : {}) } } };
  });
  return { nodes: withDetails, edges };
}

/**
 * Turns anything read from a file or storage into a diagram the editor can safely render.
 * Throws DiagramFileError only when the input isn't a diagram at all.
 */
export function parseDiagram(input: unknown): ParsedDiagram {
  if (!isObject(input)) throw new DiagramFileError("That file isn't a Building Block diagram.");
  if (typeof input.schemaVersion === "number" && input.schemaVersion > 1) {
    throw new DiagramFileError("That diagram was made by a newer version of Building Block.");
  }
  if (input.schemaVersion !== 1 || !Array.isArray(input.sections)) {
    throw new DiagramFileError("That file isn't a Building Block diagram.");
  }

  const fixes: string[] = [];
  const legend = parseLegend(input.legend, fixes);
  const legendKeys = new Set(legend.map((entry) => entry.key));

  const sectionIds = new Set<string>();
  let sections = input.sections.map((raw, index) => {
    const section = parseSection(raw, index, legendKeys, fixes);
    // Section ids must be unique for tabs and undo to work.
    if (sectionIds.has(section.id)) section.id = createId("section");
    sectionIds.add(section.id);
    return section;
  });
  if (!sections.length) sections = [createBlankSection()];

  const activeSectionId = text(input.activeSectionId);
  const now = new Date().toISOString();
  const diagram: Diagram = {
    schemaVersion: 1,
    id: text(input.id) || createId("diagram"),
    name: text(input.name)?.trim() || "Imported diagram",
    legend,
    sections,
    activeSectionId: sections.some((section) => section.id === activeSectionId) ? activeSectionId! : sections[0].id,
    createdAt: text(input.createdAt) ?? now,
    updatedAt: text(input.updatedAt) ?? now,
  };
  if (typeof input.showTechnology === "boolean") diagram.showTechnology = input.showTechnology;
  // Reopen the internal design that was open when the file was saved, if that component is still there.
  const activeDetailId = text(input.activeDetailId);
  const activeSection = sections.find((section) => section.id === diagram.activeSectionId)!;
  if (activeDetailId && activeSection.nodes.some((node) => node.id === activeDetailId && node.type === "block")) {
    diagram.activeDetailId = activeDetailId;
  }
  return { diagram, fixes };
}
