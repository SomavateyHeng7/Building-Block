import { COMPONENT_ICON_KEYS } from "./componentIcons";
import { DEFAULT_LEGEND } from "./defaultLegend";
import { createBlankSection, createId } from "./factory";
import { MAX_EDGES, MAX_NAME_LENGTH, MAX_NODES, MAX_PARTICIPANTS, MAX_SECTIONS, MAX_STEPS, MAX_TEXT_LENGTH } from "./limits";
import { parseBranding } from "./branding";
import { MAX_CHECKPOINTS, snapshotOf, type Checkpoint } from "./checkpoints";
import { MAX_COMMENTS, commentTargets } from "./comments";
import { safeWebAddress } from "./webAddress";
import { syncLinkedParticipants } from "./sequence";
import type {
  ConnectionSide,
  ContainerStyle,
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramSection,
  LegendEntry,
  NodeDetails,
  ReviewComment,
  SequenceDiagram,
  SequenceParticipant,
  SequenceStep,
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

/** How many strings were cut to a limit during the current parse (parsing is synchronous, so one counter is enough). */
let cutTexts = 0;

function text(value: unknown, limit = MAX_TEXT_LENGTH): string | undefined {
  const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : undefined;
  if (raw === undefined || raw.length <= limit) return raw;
  cutTexts += 1;
  return raw.slice(0, limit);
}

/** A name or label: text cut to a shorter limit. */
function nameText(value: unknown): string | undefined {
  return text(value, MAX_NAME_LENGTH);
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
    legend.push({ key, label: nameText(item.label) ?? key, color });
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
  // A link is only kept if it is a plain web address, so a file can't carry a javascript: or data: link into the app.
  const link = safeWebAddress(text(data.link));
  if (link) details.link = link;
  const colorKey = text(data.colorKey);
  const icon = type === "block" ? oneOf(data.icon, COMPONENT_ICON_KEYS) : undefined;
  const unknownIcon = type === "block" && data.icon !== undefined && !icon;
  const label = nameText(data.label) ?? (type === "container" ? "Untitled Container" : "Untitled");
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

/** A sequence tab's participants and steps; steps that name a missing participant are dropped. */
function parseSequence(raw: unknown, name: string, legendKeys: Set<string>, fixes: string[]): SequenceDiagram {
  const sequence = isObject(raw) ? raw : {};
  const participants: SequenceParticipant[] = [];
  const ids = new Set<string>();
  let dropped = 0;
  for (const item of Array.isArray(sequence.participants) ? sequence.participants : []) {
    const id = isObject(item) ? text(item.id) : undefined;
    if (!isObject(item) || !id || ids.has(id)) {
      dropped += 1;
      continue;
    }
    ids.add(id);
    const colorKey = text(item.colorKey);
    const description = text(item.description)?.trim();
    participants.push({
      id,
      label: nameText(item.label)?.trim() || "Participant",
      ...(item.shape === "actor" ? { shape: "actor" as const } : {}),
      ...(colorKey && legendKeys.has(colorKey) ? { colorKey } : {}),
      ...(description ? { description } : {}),
      // Checked against the other tabs once they're all read (see parseDiagram).
      ...(isObject(item.component) && text(item.component.sectionId) && text(item.component.id)
        ? { component: { sectionId: text(item.component.sectionId)!, id: text(item.component.id)! } }
        : {}),
    });
  }
  if (dropped) fixes.push(`"${name}": skipped ${plural(dropped, "participant")} that couldn't be read.`);

  const steps: SequenceStep[] = [];
  const stepIds = new Set<string>();
  let droppedSteps = 0;
  for (const item of Array.isArray(sequence.steps) ? sequence.steps : []) {
    const id = isObject(item) ? text(item.id) : undefined;
    if (!isObject(item) || !id || stepIds.has(id)) {
      droppedSteps += 1;
      continue;
    }
    if (item.type === "message") {
      const from = text(item.from);
      const to = text(item.to);
      if (!from || !to || !ids.has(from) || !ids.has(to)) {
        droppedSteps += 1;
        continue;
      }
      const label = nameText(item.label)?.trim();
      const protocol = text(item.protocol)?.trim();
      const kind = oneOf(item.kind, ["call", "async", "reply"] as const);
      stepIds.add(id);
      steps.push({
        id,
        type: "message",
        from,
        to,
        ...(label ? { label } : {}),
        ...(protocol ? { protocol } : {}),
        ...(kind && kind !== "call" ? { kind } : {}),
      });
    } else if (item.type === "note") {
      const over = (Array.isArray(item.over) ? item.over : []).map((value) => text(value)).filter((value): value is string => !!value && ids.has(value)).slice(0, 2);
      if (!over.length) {
        droppedSteps += 1;
        continue;
      }
      stepIds.add(id);
      steps.push({ id, type: "note", over, text: text(item.text) ?? "" });
    } else {
      droppedSteps += 1;
    }
  }
  if (droppedSteps) fixes.push(`"${name}": skipped ${plural(droppedSteps, "step")} that couldn't be read or named a missing participant.`);
  return { participants, steps, ...(sequence.numbered === false ? { numbered: false } : {}) };
}

function parseSection(raw: unknown, index: number, legendKeys: Set<string>, fixes: string[]): DiagramSection {
  const section = isObject(raw) ? raw : {};
  const name = nameText(section.name) || `Section ${index + 1}`;
  if (section.kind === "sequence") {
    return {
      id: text(section.id) || createId("section"),
      name,
      kind: "sequence",
      nodes: [],
      sequence: parseSequence(section.sequence, name, legendKeys, fixes),
    };
  }
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

const count = (value: unknown) => (Array.isArray(value) ? value.length : 0);

/** Refuses a file with more content than the editor can handle, before any of it is read. */
function checkSize(sections: unknown[]): void {
  const tooBig = () => new DiagramFileError("That diagram is too large to open.");
  if (sections.length > MAX_SECTIONS) throw tooBig();
  const view = (raw: unknown) => {
    if (!isObject(raw) || count(raw.nodes) > MAX_NODES || count(raw.edges) > MAX_EDGES) return false;
    return (Array.isArray(raw.nodes) ? raw.nodes : []).every((node) => {
      const detail = isObject(node) && isObject(node.data) ? node.data.detail : undefined;
      return detail === undefined || (isObject(detail) && count(detail.nodes) <= MAX_NODES && count(detail.edges) <= MAX_EDGES);
    });
  };
  for (const section of sections) {
    if (!isObject(section)) continue;
    const sequence = isObject(section.sequence) ? section.sequence : {};
    if (!view(section) || count(sequence.participants) > MAX_PARTICIPANTS || count(sequence.steps) > MAX_STEPS) throw tooBig();
  }
}

/**
 * Turns anything read from a file or storage into a diagram the editor can safely render.
 * Throws DiagramFileError only when the input isn't a diagram at all.
 */
/** Each checkpoint's snapshot is read like a diagram of its own, so it gets every check and repair an opened file does. */
function parseCheckpoints(raw: unknown, fixes: string[]): Checkpoint[] {
  if (!Array.isArray(raw)) return [];
  // Reading a snapshot restarts the count of cut texts, which belongs to the file being read.
  const outerCut = cutTexts;
  const seen = new Set<string>();
  const checkpoints: Checkpoint[] = [];
  let dropped = Math.max(0, raw.length - MAX_CHECKPOINTS);
  for (const item of raw.slice(0, MAX_CHECKPOINTS)) {
    const id = isObject(item) ? text(item.id) : undefined;
    const snapshot = isObject(item) && isObject(item.snapshot) ? item.snapshot : undefined;
    if (!isObject(item) || !id || !snapshot || seen.has(id)) {
      dropped += 1;
      continue;
    }
    try {
      const { diagram } = parseDiagram({ ...snapshot, schemaVersion: 1, activeSectionId: undefined, checkpoints: undefined, comments: undefined });
      const createdAt = text(item.createdAt);
      seen.add(id);
      checkpoints.push({
        id,
        name: nameText(item.name)?.trim() || `Checkpoint ${checkpoints.length + 1}`,
        createdAt: createdAt && !Number.isNaN(Date.parse(createdAt)) ? createdAt : new Date(0).toISOString(),
        snapshot: snapshotOf(diagram),
      });
    } catch {
      dropped += 1;
    }
  }
  cutTexts = outerCut;
  if (dropped) fixes.push(`Left out ${dropped} checkpoint${dropped === 1 ? "" : "s"} that couldn't be read.`);
  return checkpoints;
}

function parseComments(raw: unknown, targets: Set<string>, fixes: string[]): ReviewComment[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const comments: ReviewComment[] = [];
  let dropped = 0;
  for (const item of raw) {
    const id = isObject(item) ? text(item.id) : undefined;
    const targetId = isObject(item) ? text(item.targetId) : undefined;
    const body = isObject(item) ? text(item.text)?.trim() : undefined;
    if (!isObject(item) || !id || !targetId || !body || seen.has(id) || !targets.has(targetId) || comments.length >= MAX_COMMENTS) {
      dropped += 1;
      continue;
    }
    seen.add(id);
    const createdAt = text(item.createdAt);
    comments.push({
      id,
      targetId,
      author: nameText(item.author)?.trim() || "Reviewer",
      text: body,
      createdAt: createdAt && !Number.isNaN(Date.parse(createdAt)) ? createdAt : new Date(0).toISOString(),
      ...(item.resolved === true ? { resolved: true } : {}),
    });
  }
  if (dropped) fixes.push(`Left out ${dropped} review comment${dropped === 1 ? "" : "s"} that were empty, repeated or about something no longer in the diagram.`);
  return comments;
}

export function parseDiagram(input: unknown): ParsedDiagram {
  if (!isObject(input)) throw new DiagramFileError("That file isn't a Building Block diagram.");
  if (typeof input.schemaVersion === "number" && input.schemaVersion > 1) {
    throw new DiagramFileError("That diagram was made by a newer version of Building Block.");
  }
  if (input.schemaVersion !== 1 || !Array.isArray(input.sections)) {
    throw new DiagramFileError("That file isn't a Building Block diagram.");
  }

  checkSize(input.sections);
  cutTexts = 0;
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
  // Participants linked to a component take its name and colour; links to missing components are dropped.
  const links = (list: DiagramSection[]) =>
    list.flatMap((section) => section.sequence?.participants.filter((participant) => participant.component) ?? []).length;
  const before = links(sections);
  sections = syncLinkedParticipants({ sections }).sections;
  const unlinked = before - links(sections);
  if (unlinked) fixes.push(`Unlinked ${plural(unlinked, "sequence participant")} from components that are no longer there.`);

  const diagram: Diagram = {
    schemaVersion: 1,
    id: text(input.id) || createId("diagram"),
    name: nameText(input.name)?.trim() || "Imported diagram",
    legend,
    sections,
    activeSectionId: sections.some((section) => section.id === activeSectionId) ? activeSectionId! : sections[0].id,
    createdAt: text(input.createdAt) ?? now,
    updatedAt: text(input.updatedAt) ?? now,
  };
  if (typeof input.showTechnology === "boolean") diagram.showTechnology = input.showTechnology;
  const checkpoints = parseCheckpoints(input.checkpoints, fixes);
  if (checkpoints.length) diagram.checkpoints = checkpoints;
  const comments = parseComments(input.comments, commentTargets({ sections }), fixes);
  if (comments.length) diagram.comments = comments;
  const branding = parseBranding(input.branding);
  if (branding) diagram.branding = branding;
  else if (input.branding !== undefined) fixes.push("Left out the export logo and colour: they weren't a valid picture and colour.");
  // Reopen the internal design that was open when the file was saved, if that component is still there.
  const activeDetailId = text(input.activeDetailId);
  const activeSection = sections.find((section) => section.id === diagram.activeSectionId)!;
  if (activeDetailId && activeSection.nodes.some((node) => node.id === activeDetailId && node.type === "block")) {
    diagram.activeDetailId = activeDetailId;
  }
  if (cutTexts) fixes.push(`Shortened ${plural(cutTexts, "very long name or text")}.`);
  return { diagram, fixes };
}
