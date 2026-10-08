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
    const color = isObject(item) ? text(item.color) : undefined;
    if (!isObject(item) || !key || seen.has(key) || !color || !HEX_COLOR.test(color)) {
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
  const outlineColor = text(data.outlineColor);
  if (headerPosition) style.headerPosition = headerPosition;
  if (headerAlign) style.headerAlign = headerAlign;
  if (outlineStyle) style.outlineStyle = outlineStyle;
  if (outlineColor && HEX_COLOR.test(outlineColor)) style.outlineColor = outlineColor;
  return style;
}

/** Returns null for a node that can't be used; `repaired` is set when defaults were filled in. */
function parseNode(raw: unknown, legendKeys: Set<string>): { node: DiagramNode; repaired: boolean } | null {
  if (!isObject(raw)) return null;
  const id = text(raw.id);
  const type = oneOf(raw.type, ["container", "block"] as const);
  if (!id || !type) return null;

  const data = isObject(raw.data) ? raw.data : {};
  const position = isObject(raw.position) ? raw.position : {};
  const size = isObject(raw.size) ? raw.size : {};
  const width = finite(size.width);
  const height = finite(size.height);

  const details: NodeDetails = {};
  for (const key of DETAIL_KEYS) {
    const value = text(data[key])?.trim();
    if (value) details[key] = value;
  }
  const colorKey = text(data.colorKey);
  const label = text(data.label) ?? (type === "container" ? "Untitled Container" : "Untitled");
  const repaired =
    typeof data.label !== "string" ||
    finite(position.x) === undefined ||
    finite(position.y) === undefined ||
    !(width && width > 0) ||
    !(height && height > 0);

  const node: DiagramNode = {
    id,
    type,
    position: { x: finite(position.x) ?? 0, y: finite(position.y) ?? 0 },
    size: {
      width: width && width > 0 ? width : DEFAULT_SIZE[type].width,
      height: height && height > 0 ? height : DEFAULT_SIZE[type].height,
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
          },
  };
  return { node, repaired };
}

const SIDES = ["top", "right", "bottom", "left"] as const satisfies readonly ConnectionSide[];

/** Keeps connections between two different components that exist; reports what was dropped. */
function parseEdges(raw: unknown, nodes: DiagramNode[], name: string, fixes: string[]): DiagramEdge[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    fixes.push(`"${name}": skipped connections that couldn't be read.`);
    return [];
  }
  const blockIds = new Set(nodes.filter((node) => node.type === "block").map((node) => node.id));
  const ids = new Set<string>();
  const edges: DiagramEdge[] = [];
  let dropped = 0;
  for (const item of raw) {
    const id = isObject(item) ? text(item.id) : undefined;
    const source = isObject(item) ? text(item.source) : undefined;
    const target = isObject(item) ? text(item.target) : undefined;
    if (!isObject(item) || !id || ids.has(id) || !source || !target || source === target || !blockIds.has(source) || !blockIds.has(target)) {
      dropped += 1;
      continue;
    }
    ids.add(id);
    const edge: DiagramEdge = { id, source, target };
    const sourceSide = oneOf(item.sourceSide, SIDES);
    const targetSide = oneOf(item.targetSide, SIDES);
    const direction = oneOf(item.direction, ["forward", "both", "none"] as const);
    const style = oneOf(item.style, ["solid", "dashed"] as const);
    if (sourceSide) edge.sourceSide = sourceSide;
    if (targetSide) edge.targetSide = targetSide;
    if (direction) edge.direction = direction;
    if (style) edge.style = style;
    for (const key of ["label", "protocol", "description"] as const) {
      const value = text(item[key])?.trim();
      if (value) edge[key] = value;
    }
    edges.push(edge);
  }
  if (dropped) fixes.push(`"${name}": skipped ${plural(dropped, "connection")} that didn't join two components.`);
  return edges;
}

function parseSection(raw: unknown, index: number, legendKeys: Set<string>, fixes: string[]): DiagramSection {
  const section = isObject(raw) ? raw : {};
  const name = text(section.name) || `Section ${index + 1}`;
  const rawNodes = Array.isArray(section.nodes) ? section.nodes : [];

  const nodes: DiagramNode[] = [];
  const ids = new Set<string>();
  let unreadable = 0;
  let duplicates = 0;
  let repaired = 0;
  for (const item of rawNodes) {
    const parsed = parseNode(item, legendKeys);
    if (!parsed) unreadable += 1;
    else if (ids.has(parsed.node.id)) duplicates += 1;
    else {
      ids.add(parsed.node.id);
      nodes.push(parsed.node);
      if (parsed.repaired) repaired += 1;
    }
  }
  if (unreadable) fixes.push(`"${name}": skipped ${plural(unreadable, "item")} that couldn't be read.`);
  if (duplicates) fixes.push(`"${name}": skipped ${plural(duplicates, "duplicate item")}.`);
  if (repaired) {
    fixes.push(`"${name}": filled in a missing name, size or position for ${plural(repaired, "item")}.`);
  }

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

  const edges = parseEdges(section.edges, linked, name, fixes);
  return { id: text(section.id) || createId("section"), name, nodes: linked, ...(edges.length ? { edges } : {}) };
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
  return { diagram, fixes };
}
