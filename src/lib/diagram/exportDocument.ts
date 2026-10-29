import { componentIcon } from "./componentIcons";
import { exportViews } from "./exportPlan";
import { safeWebAddress } from "./webAddress";
import { toMermaidSequence } from "./exportMermaid";
import type { Diagram, DiagramEdge, DiagramNode } from "./types";

/**
 * The diagram as a solution document in Markdown: for each tab, its picture (when one was exported with it), the
 * components and connections as tables, and what each component is made of; then the legend, open review comments
 * and saved checkpoints. It reads the same data as the CSV lists, laid out the way an architect writes it up.
 */

export interface DocumentOptions {
  /** The picture file for a view (`ExportView.id`), when one is being exported alongside; it is linked, not embedded. */
  images?: ReadonlyMap<string, string>;
  /** Shown under the title. Passed in so the output is the same for the same inputs. */
  date?: string;
}

/**
 * Text from the diagram, made safe to put in Markdown. A diagram file can come from anyone, and this document is
 * opened in other tools, so what someone typed must stay text: no links (`[x](javascript:…)`), no images, no HTML,
 * no emphasis, and nothing that splits a table. Backslash-escapes keep the characters showing as typed.
 */
function cell(value: string | undefined): string {
  return (value ?? "")
    .replace(/[\\|`*_[\]~()]/g, "\\$&")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br>")
    .trim();
}

function table(header: string[], rows: string[][]): string[] {
  return [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.join(" | ")} |`), ""];
}

/** A link target that cannot end the link early or start another: brackets, parentheses, spaces and angle brackets are percent-encoded. */
function target(address: string): string {
  return address.replace(/[\s()[\]<>`\\]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}

function link(address: string | undefined): string {
  // Only plain web addresses become links; anything else is shown as text.
  const href = safeWebAddress(address);
  return href ? `[${cell(href)}](${target(href)})` : cell(address);
}

function componentTable(diagram: Diagram, nodes: DiagramNode[]): string[] {
  if (!nodes.length) return [];
  const categories = new Map(diagram.legend.map((entry) => [entry.key, entry.label]));
  const name = (id: string | undefined) => nodes.find((node) => node.id === id)?.data.label ?? "";
  return [
    ...table(
      ["Name", "Type", "In", "Category", "Technology", "Owner", "Description", "Link"],
      nodes.map((node) => [
        cell(node.data.label),
        node.type === "container" ? "Container" : cell(node.data.kind === "block" ? (componentIcon(node.data.icon)?.label ?? "Component") : "Component"),
        cell(name(node.parentId)),
        cell(node.data.colorKey ? categories.get(node.data.colorKey) : ""),
        cell(node.data.technology),
        cell(node.data.owner),
        cell(node.data.description),
        link(node.data.link),
      ]),
    ),
    ...notesList(nodes),
  ];
}

/** Notes can be long, so they are listed under the table instead of widening it. */
function notesList(nodes: DiagramNode[]): string[] {
  const withNotes = nodes.filter((node) => node.data.notes);
  if (!withNotes.length) return [];
  return ["**Notes**", "", ...withNotes.map((node) => `- **${cell(node.data.label)}:** ${cell(node.data.notes)}`), ""];
}

function connectionTable(nodes: DiagramNode[], edges: DiagramEdge[]): string[] {
  const name = (id: string) => nodes.find((node) => node.id === id)?.data.label ?? "";
  const rows = edges.filter((edge) => name(edge.source) && name(edge.target));
  if (!rows.length) return [];
  const direction = { forward: "→", both: "↔", none: "—" };
  return table(
    ["From", "", "To", "What flows", "Protocol", "Description"],
    rows.map((edge) => [
      cell(name(edge.source)),
      direction[edge.direction ?? "forward"],
      cell(name(edge.target)),
      cell(edge.label),
      cell(edge.protocol),
      cell(edge.description),
    ]),
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function solutionDocument(diagram: Diagram, { images, date }: DocumentOptions = {}): string {
  const views = exportViews(diagram);
  const lines: string[] = [`# ${cell(diagram.name) || "Untitled diagram"}`, ""];
  lines.push(`_Generated from Building Block${date ? ` on ${date}` : ""}._`, "");

  for (const section of diagram.sections) {
    lines.push(`## ${cell(section.name)}`, "");
    const picture = images?.get(section.id);
    if (picture) lines.push(`![${cell(section.name)}](${target(encodeURI(picture))})`, "");

    if (section.sequence) {
      lines.push("```mermaid", toMermaidSequence(section.sequence, section.name).trimEnd(), "```", "");
      continue;
    }
    if (!section.nodes.length) {
      lines.push("_Nothing on this tab yet._", "");
      continue;
    }
    lines.push("### Components", "", ...componentTable(diagram, section.nodes));
    const connections = connectionTable(section.nodes, section.edges ?? []);
    if (connections.length) lines.push("### Connections", "", ...connections);

    for (const component of section.nodes) {
      if (component.data.kind !== "block" || !component.data.detail?.nodes.length) continue;
      const detail = component.data.detail;
      lines.push(`### Internal design: ${cell(component.data.label)}`, "");
      const innerPicture = images?.get(views.find((view) => view.componentId === component.id && view.sectionId === section.id)?.id ?? "");
      if (innerPicture) lines.push(`![${cell(component.data.label)}](${target(encodeURI(innerPicture))})`, "");
      lines.push(...componentTable(diagram, detail.nodes), ...connectionTable(detail.nodes, detail.edges ?? []));
    }
  }

  if (diagram.legend.length) {
    lines.push("## Legend", "", ...table(["Category", "Colour"], diagram.legend.map((entry) => [cell(entry.label), `\`${entry.color}\``])));
  }

  const names = new Map<string, string>();
  const targets = new Map<string, string>();
  for (const section of diagram.sections) {
    for (const node of section.nodes) {
      targets.set(node.id, node.data.label);
      if (node.data.kind === "block") for (const inner of node.data.detail?.nodes ?? []) targets.set(inner.id, `${inner.data.label} (in ${node.data.label})`);
    }
    for (const edge of section.edges ?? []) {
      names.set(edge.id, `${targets.get(edge.source) ?? "?"} → ${targets.get(edge.target) ?? "?"}`);
    }
    for (const node of section.nodes) {
      if (node.data.kind !== "block") continue;
      for (const edge of node.data.detail?.edges ?? []) {
        const inner = node.data.detail!.nodes;
        names.set(edge.id, `${inner.find((n) => n.id === edge.source)?.data.label ?? "?"} → ${inner.find((n) => n.id === edge.target)?.data.label ?? "?"} (in ${node.data.label})`);
      }
    }
  }
  const open = (diagram.comments ?? []).filter((comment) => !comment.resolved && (targets.has(comment.targetId) || names.has(comment.targetId)));
  if (open.length) {
    lines.push(`## Open review comments (${open.length})`, "");
    for (const comment of open) {
      const about = targets.get(comment.targetId) ?? names.get(comment.targetId) ?? "";
      const when = comment.createdAt.slice(0, 10);
      lines.push(`- **${cell(about)}** — ${cell(comment.author)}, ${when}: ${cell(comment.text)}`);
    }
    lines.push("");
  }

  if (diagram.checkpoints?.length) {
    lines.push("## Version history", "");
    for (const checkpoint of diagram.checkpoints) {
      const tabs = plural(checkpoint.snapshot.sections.length, "tab");
      lines.push(`- **${cell(checkpoint.name)}** — ${checkpoint.createdAt.slice(0, 10)} (${tabs})`);
    }
    lines.push("");
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
