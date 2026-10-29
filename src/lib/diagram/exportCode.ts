import { toMermaidSequence } from "./exportMermaid";
import type { ExportView } from "./exportPlan";
import type { Diagram, DiagramEdge, DiagramNode } from "./types";

/**
 * A view as diagram code, for architects who keep documentation in git: a Mermaid flowchart (a sequence tab gives
 * Mermaid sequence code) or C4-PlantUML. Containers become subgraphs or boundaries, components become boxes, and
 * connections keep their label, protocol, direction and dashed line. Colours and positions aren't code, so
 * they are left out.
 */

interface Canvas {
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** The nodes and connections of a view: a tab, or a component's internal design. */
function canvasOf(diagram: Diagram, view: ExportView): Canvas | null {
  const section = diagram.sections.find((candidate) => candidate.id === view.sectionId);
  if (!section) return null;
  if (!view.componentId) return { title: `${diagram.name} — ${section.name}`, nodes: section.nodes, edges: section.edges ?? [] };
  const component = section.nodes.find((node) => node.id === view.componentId);
  const detail = component?.data.kind === "block" ? component.data.detail : undefined;
  if (!component || !detail) return null;
  return { title: `${diagram.name} — ${section.name} — ${component.data.label} (internal design)`, nodes: detail.nodes, edges: detail.edges ?? [] };
}

/** Ids that every tool accepts: n1, n2… in the order the nodes are listed. */
function codeIds(nodes: DiagramNode[]): Map<string, string> {
  return new Map(nodes.map((node, index) => [node.id, `n${index + 1}`]));
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** What a connection says: "Orders (REST)", "Orders", "REST", or nothing. */
function caption(edge: DiagramEdge): string {
  const label = oneLine(edge.label ?? "");
  const protocol = oneLine(edge.protocol ?? "");
  return label && protocol ? `${label} (${protocol})` : label || protocol;
}

const mermaidText = (value: string) => oneLine(value).replace(/"/g, "#quot;");

/** A Mermaid `flowchart LR`. */
export function flowchartMermaid(canvas: Canvas): string {
  const ids = codeIds(canvas.nodes);
  const lines = [`---`, `title: ${mermaidText(canvas.title)}`, `---`, `flowchart LR`];
  const node = (item: DiagramNode, indent: string) => {
    const tech = item.data.kind === "block" && item.data.technology ? `<br/>[${mermaidText(item.data.technology)}]` : "";
    lines.push(`${indent}${ids.get(item.id)}["${mermaidText(item.data.label)}${tech}"]`);
  };
  for (const container of canvas.nodes.filter((item) => item.type === "container")) {
    lines.push(`  subgraph ${ids.get(container.id)}["${mermaidText(container.data.label)}"]`);
    for (const child of canvas.nodes.filter((item) => item.parentId === container.id && item.type === "block")) node(child, "    ");
    lines.push("  end");
  }
  for (const item of canvas.nodes.filter((candidate) => candidate.type === "block" && !canvas.nodes.some((parent) => parent.id === candidate.parentId))) {
    node(item, "  ");
  }
  for (const edge of canvas.edges) {
    const from = ids.get(edge.source);
    const to = ids.get(edge.target);
    if (!from || !to) continue;
    const dashed = edge.style === "dashed";
    const direction = edge.direction ?? "forward";
    const arrow =
      direction === "both" ? (dashed ? "<-.->" : "<-->") : direction === "none" ? (dashed ? "-.-" : "---") : dashed ? "-.->" : "-->";
    const text = caption(edge);
    lines.push(`  ${from} ${arrow}${text ? `|"${mermaidText(text)}"|` : ""} ${to}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * PlantUML runs `%function()` calls (such as `%getenv`) found anywhere in the text when it renders, and a diagram can
 * come from anyone, so `%` is written as PlantUML's own Unicode escape. Quotes would end the string early.
 */
const pumlText = (value: string) => oneLine(value).replace(/"/g, "'").replace(/%/g, "<U+0025>");

/** C4-PlantUML (container diagram): containers as boundaries, components as `Container(…)`. */
export function plantUml(canvas: Canvas): string {
  const ids = codeIds(canvas.nodes);
  const lines = ["@startuml", "!include <C4/C4_Container>", `title ${pumlText(canvas.title)}`, "LAYOUT_WITH_LEGEND()", ""];
  const box = (item: DiagramNode, indent: string) => {
    const technology = item.data.technology ?? "";
    lines.push(`${indent}Container(${ids.get(item.id)}, "${pumlText(item.data.label)}", "${pumlText(technology)}", "${pumlText(item.data.description ?? "")}")`);
  };
  for (const container of canvas.nodes.filter((item) => item.type === "container")) {
    lines.push(`Boundary(${ids.get(container.id)}, "${pumlText(container.data.label)}") {`);
    for (const child of canvas.nodes.filter((item) => item.parentId === container.id && item.type === "block")) box(child, "  ");
    lines.push("}");
  }
  for (const item of canvas.nodes.filter((candidate) => candidate.type === "block" && !canvas.nodes.some((parent) => parent.id === candidate.parentId))) {
    box(item, "");
  }
  lines.push("");
  for (const edge of canvas.edges) {
    const from = ids.get(edge.source);
    const to = ids.get(edge.target);
    if (!from || !to) continue;
    const call = edge.direction === "both" ? "BiRel" : "Rel";
    lines.push(`${call}(${from}, ${to}, "${pumlText(edge.label ?? "")}", "${pumlText(edge.protocol ?? "")}")`);
  }
  lines.push("@enduml");
  return `${lines.join("\n")}\n`;
}

/** The code file's text for a view, or null when the format has nothing to say about it (PlantUML for a sequence tab). */
export function codeForView(diagram: Diagram, view: ExportView, format: "mermaid" | "plantuml"): string | null {
  const section = diagram.sections.find((candidate) => candidate.id === view.sectionId);
  if (section?.sequence && !view.componentId) {
    return format === "mermaid" ? toMermaidSequence(section.sequence, section.name) : null;
  }
  const canvas = canvasOf(diagram, view);
  if (!canvas) return null;
  return format === "mermaid" ? flowchartMermaid(canvas) : plantUml(canvas);
}
