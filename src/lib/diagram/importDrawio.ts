import { createId } from "./factory";
import { ImportError } from "./importMermaid";
import { containerInsets, growContainerToFit, suggestConnectionSides } from "./layout";
import type { ConnectionSide, DiagramEdge, DiagramNode, DiagramSection, LegendEntry } from "./types";
import { decodeEntities, findAll, parseXml, type XmlElement } from "./xml";

export interface DrawioImport {
  /** One architecture tab per draw.io page. */
  sections: DiagramSection[];
  /** Categories made for the fill colours used; reuses earlier imported ones that match. */
  legend: LegendEntry[];
  fixes: string[];
}

/** The prefix of the categories made for imported colours, so a later import can reuse them. */
export const IMPORTED_CATEGORY = "Imported";

interface Cell {
  id: string;
  parent?: string;
  label: string;
  tooltip?: string;
  style: Map<string, string>;
  /** The first style token when it has no "=", e.g. "text", "swimlane", "ellipse". */
  shape?: string;
  vertex: boolean;
  edge: boolean;
  source?: string;
  target?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function parseStyle(style: string): { map: Map<string, string>; shape?: string } {
  const map = new Map<string, string>();
  let shape: string | undefined;
  style.split(";").forEach((token, index) => {
    if (!token) return;
    const equals = token.indexOf("=");
    if (equals === -1) {
      if (index === 0) shape = token;
      map.set(token, "1");
    } else map.set(token.slice(0, equals), token.slice(equals + 1));
  });
  return { map, shape };
}

/** draw.io labels are often HTML; keep the text, with line breaks as spaces. */
export function plainLabel(value: string): string {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(div|p|li)>/gi, " ")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hex(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) return `#${[...color.slice(1)].map((digit) => digit + digit).join("")}`;
  return undefined;
}

function number(value: string | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readCells(model: XmlElement): Cell[] {
  // A cell is an <mxCell>, or an <object>/<UserObject> wrapping one (which holds the id and the label).
  const holders = findAll(model, "root")[0]?.children ?? [];
  return holders.flatMap((holder): Cell[] => {
    const cell = holder.name === "mxCell" ? holder : holder.children.find((child) => child.name === "mxCell");
    if (!cell) return [];
    const id = holder.attributes.id ?? cell.attributes.id;
    if (!id) return [];
    const geometry = cell.children.find((child) => child.name === "mxGeometry");
    const { map, shape } = parseStyle(cell.attributes.style ?? "");
    return [
      {
        id,
        parent: cell.attributes.parent,
        label: plainLabel(holder === cell ? (cell.attributes.value ?? "") : (holder.attributes.label ?? "")),
        tooltip: holder.attributes.tooltip ? plainLabel(holder.attributes.tooltip) : undefined,
        style: map,
        shape,
        vertex: cell.attributes.vertex === "1",
        edge: cell.attributes.edge === "1",
        source: cell.attributes.source,
        target: cell.attributes.target,
        x: number(geometry?.attributes.x),
        y: number(geometry?.attributes.y),
        width: number(geometry?.attributes.width, 120),
        height: number(geometry?.attributes.height, 60),
      },
    ];
  });
}

/** A compressed draw.io page: base64 of raw-deflated, URI-encoded XML. */
async function inflatePage(text: string): Promise<string> {
  const bytes = Uint8Array.from(atob(text.trim()), (char) => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const inflated = await new Response(stream).text();
  return decodeURIComponent(inflated);
}

/** Each page's name and graph model, whether the file is an <mxfile> (compressed or not) or a bare model. */
async function readPages(root: XmlElement): Promise<{ name: string; model: XmlElement }[]> {
  if (root.name === "mxGraphModel") return [{ name: "Page-1", model: root }];
  if (root.name !== "mxfile") throw new ImportError("That isn't a draw.io file. Save it from draw.io as .drawio or .xml (not .svg or .png).");
  const pages = await Promise.all(
    root.children
      .filter((child) => child.name === "diagram")
      .map(async (page, index) => {
        const name = page.attributes.name || `Page-${index + 1}`;
        const inline = page.children.find((child) => child.name === "mxGraphModel");
        if (inline) return { name, model: inline };
        if (!page.text.trim()) return null;
        try {
          return { name, model: parseXml(await inflatePage(page.text)) };
        } catch {
          throw new ImportError(`Couldn't read the page "${name}" in that draw.io file.`);
        }
      }),
  );
  return pages.filter((page): page is { name: string; model: XmlElement } => page !== null);
}

const STEP_STYLES = new Set(["orthogonalEdgeStyle", "elbowEdgeStyle", "entityRelationEdgeStyle", "isometricEdgeStyle"]);

/** draw.io's exit/entry points are fractions of the box; the nearest edge is the side. */
function side(x: string | undefined, y: string | undefined): ConnectionSide | undefined {
  if (x === undefined || y === undefined) return undefined;
  const fx = Number(x);
  const fy = Number(y);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return undefined;
  const distances: [ConnectionSide, number][] = [
    ["left", fx],
    ["right", 1 - fx],
    ["top", fy],
    ["bottom", 1 - fy],
  ];
  return distances.sort((a, b) => a[1] - b[1])[0][0];
}

/**
 * Turns one draw.io page into a tab. Shapes become components; swimlanes, containers and shapes with shapes
 * inside become containers (one level: deeper ones are lifted out, keeping their place on screen); groups
 * are dissolved; free text is left out. Fill colours become legend categories, arrows become connections.
 */
function convertPage(
  name: string,
  cells: Cell[],
  categoryFor: (color: string) => string,
  counts: { text: number; nested: number; edges: number },
): DiagramSection {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const rootIds = new Set(cells.filter((cell) => !cell.parent).map((cell) => cell.id));
  const isLayer = (id: string | undefined) => !!id && byId.get(id)?.parent !== undefined && rootIds.has(byId.get(id)!.parent!);
  const vertices = cells.filter((cell) => cell.vertex && !isLayer(cell.id) && !rootIds.has(cell.id));
  const isEdgeLabel = (cell: Cell) => cell.style.has("edgeLabel") || (cell.parent !== undefined && byId.get(cell.parent)?.edge === true);
  const isText = (cell: Cell) => cell.shape === "text" || (cell.style.get("strokeColor") === "none" && cell.style.get("fillColor") === "none" && !cell.style.has("swimlane"));
  const isGroup = (cell: Cell) => cell.shape === "group" || cell.style.get("group") === "1";
  const hasChildren = new Set(vertices.filter((cell) => !isEdgeLabel(cell)).flatMap((cell) => (cell.parent ? [cell.parent] : [])));
  const isContainer = (cell: Cell) =>
    !isGroup(cell) && (cell.style.has("swimlane") || cell.style.get("container") === "1" || hasChildren.has(cell.id));

  // Canvas position: geometry is relative to the parent shape, if any.
  const absolute = (cell: Cell): { x: number; y: number } => {
    const parent = cell.parent ? byId.get(cell.parent) : undefined;
    if (!parent || !parent.vertex || isLayer(parent.id) || rootIds.has(parent.id)) return { x: cell.x, y: cell.y };
    const origin = absolute(parent);
    return { x: origin.x + cell.x, y: origin.y + cell.y };
  };
  /** The nearest container around a cell, looking through groups and lifted containers. */
  const containerOf = (cell: Cell): Cell | undefined => {
    for (let parent = cell.parent ? byId.get(cell.parent) : undefined; parent && parent.vertex; parent = parent.parent ? byId.get(parent.parent) : undefined) {
      if (isContainer(parent)) return parent;
    }
    return undefined;
  };

  const ids = new Map<string, string>();
  const containers: DiagramNode[] = [];
  const blocks: DiagramNode[] = [];
  for (const cell of vertices) {
    if (isEdgeLabel(cell) || isGroup(cell)) continue;
    if (isText(cell) && !isContainer(cell)) {
      if (cell.label) counts.text += 1;
      continue;
    }
    const at = absolute(cell);
    const size = { width: Math.max(40, cell.width), height: Math.max(24, cell.height) };
    if (isContainer(cell)) {
      if (containerOf(cell)) counts.nested += 1;
      const id = createId("container");
      ids.set(cell.id, id);
      const outline = hex(cell.style.get("strokeColor"));
      containers.push({
        id,
        type: "container",
        position: at,
        size,
        data: {
          kind: "container",
          label: cell.label || "Untitled Container",
          ...(cell.tooltip ? { description: cell.tooltip } : {}),
          ...(outline ? { outlineColor: outline } : {}),
          ...(cell.style.get("dashed") === "1" ? { outlineStyle: "dashed" as const } : {}),
        },
      });
    } else {
      const id = createId("block");
      ids.set(cell.id, id);
      const fill = cell.style.get("fillColor");
      const color = fill === "none" ? undefined : (hex(fill) ?? "#ffffff");
      blocks.push({
        id,
        type: "block",
        position: at,
        size,
        // Placed in its container below, once every container exists.
        parentId: containerOf(cell)?.id,
        data: {
          kind: "block",
          label: cell.label || "Untitled",
          containerId: null,
          ...(color ? { colorKey: categoryFor(color) } : {}),
          ...(cell.tooltip ? { description: cell.tooltip } : {}),
        },
      });
    }
  }

  // Components sit in their container, clear of its header; the container grows to fit them.
  let nodes: DiagramNode[] = [...containers];
  const placed = blocks.map((block) => {
    const container = block.parentId ? containers.find((candidate) => candidate.id === ids.get(block.parentId!)) : undefined;
    if (!container) return { ...block, parentId: undefined };
    const insets = containerInsets();
    return {
      ...block,
      parentId: container.id,
      position: {
        x: Math.max(insets.left, block.position.x - container.position.x),
        y: Math.max(insets.top, block.position.y - container.position.y),
      },
      data: { ...block.data, containerId: container.id },
    } as DiagramNode;
  });
  nodes = [...nodes, ...placed];
  for (const container of containers) nodes = growContainerToFit(nodes, container.id);

  const edges: DiagramEdge[] = [];
  for (const cell of cells.filter((candidate) => candidate.edge)) {
    let source = cell.source ? ids.get(cell.source) : undefined;
    let target = cell.target ? ids.get(cell.target) : undefined;
    if (!source || !target || source === target) {
      counts.edges += 1;
      continue;
    }
    const startArrow = cell.style.get("startArrow");
    const endArrow = cell.style.get("endArrow");
    const hasStart = !!startArrow && startArrow !== "none";
    const hasEnd = endArrow !== "none";
    let sourceSide = side(cell.style.get("exitX"), cell.style.get("exitY"));
    let targetSide = side(cell.style.get("entryX"), cell.style.get("entryY"));
    // An arrow drawn only at the start points the other way.
    if (hasStart && !hasEnd) {
      [source, target] = [target, source];
      [sourceSide, targetSide] = [targetSide, sourceSide];
    }
    const labels = [cell.label, ...cells.filter((candidate) => candidate.parent === cell.id && candidate.label).map((candidate) => candidate.label)].filter(Boolean);
    const edgeStyle = cell.style.get("edgeStyle");
    const suggested = suggestConnectionSides(nodes, source, target);
    edges.push({
      id: createId("edge"),
      source,
      target,
      sourceSide: sourceSide ?? suggested.sourceSide,
      targetSide: targetSide ?? suggested.targetSide,
      ...(labels.length ? { label: labels.join(" ") } : {}),
      ...(hasStart && hasEnd ? { direction: "both" as const } : !hasStart && !hasEnd ? { direction: "none" as const } : {}),
      ...(cell.style.get("dashed") === "1" ? { style: "dashed" as const } : {}),
      shape: edgeStyle && STEP_STYLES.has(edgeStyle) ? "step" : cell.style.get("curved") === "1" ? "curved" : "straight",
    });
  }

  return { id: createId("section"), name, nodes, ...(edges.length ? { edges } : {}) };
}

/**
 * Reads a draw.io file (.drawio or .xml, compressed or not) into architecture tabs, one per page.
 * `legend` is the diagram's current legend: fill colours reuse its imported categories where they match.
 */
export async function parseDrawio(source: string, legend: LegendEntry[] = []): Promise<DrawioImport> {
  let root: XmlElement;
  try {
    root = parseXml(source);
  } catch {
    throw new ImportError("That file couldn't be read as a draw.io diagram.");
  }
  const pages = await readPages(root);

  const made: LegendEntry[] = [];
  const categoryFor = (color: string) => {
    const existing = [...legend.filter((entry) => entry.label.startsWith(IMPORTED_CATEGORY)), ...made].find(
      (entry) => entry.color.toLowerCase() === color,
    );
    if (existing) return existing.key;
    const entry = { key: createId("legend"), label: `${IMPORTED_CATEGORY} ${color}`, color };
    made.push(entry);
    return entry.key;
  };
  const counts = { text: 0, nested: 0, edges: 0 };
  const sections = pages
    .map((page) => convertPage(page.name, readCells(page.model), categoryFor, counts))
    .filter((section) => section.nodes.length);
  if (!sections.length) throw new ImportError("That draw.io file has no shapes to import.");

  const fixes: string[] = [];
  if (made.length) {
    fixes.push(`Made ${made.length} legend categor${made.length === 1 ? "y" : "ies"} from the fill colours used, named "${IMPORTED_CATEGORY} #…". Rename them to say what each colour means.`);
  }
  if (counts.nested) fixes.push(`Lifted ${counts.nested} container${counts.nested === 1 ? "" : "s"} out of another: containers here are one level deep.`);
  if (counts.text) fixes.push(`Left out ${counts.text} free text label${counts.text === 1 ? "" : "s"} that weren't on a shape.`);
  if (counts.edges) fixes.push(`Left out ${counts.edges} arrow${counts.edges === 1 ? "" : "s"} that didn't join two shapes.`);
  return { sections, legend: made, fixes };
}
