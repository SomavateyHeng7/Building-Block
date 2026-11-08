import type { Diagram } from "@/lib/diagram/types";
import type { TemplateDefinition } from "./types";

export interface TemplateSummary {
  /** Tab names, in order. */
  tabs: string[];
  /** Per tab: components, or participants for a sequence tab. */
  parts: number[];
  /** "participant" for a sequence, otherwise "component". */
  partName: "component" | "participant";
}

const cache = new Map<string, TemplateSummary>();

export function summarizeDiagram(diagram: Diagram): TemplateSummary {
  const sequence = diagram.sections[0]?.sequence;
  return {
    tabs: diagram.sections.map((section) => section.name),
    parts: diagram.sections.map((section) =>
      section.sequence ? section.sequence.participants.length : section.nodes.filter((node) => node.type === "block").length,
    ),
    partName: sequence ? "participant" : "component",
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * "9 components" for one tab; "3 tabs: Current, Transition, Target · 3 to 6 components each" for several.
 * Empty for a template with nothing in it. Counts don't depend on lane direction.
 */
export function describeSummary({ tabs, parts, partName }: TemplateSummary): string {
  const most = Math.max(0, ...parts);
  if (most === 0) return "";
  if (tabs.length === 1) return `1 tab · ${plural(parts[0], partName)}`;
  const least = Math.min(...parts);
  const range = least === most ? `${most}` : `${least} to ${most}`;
  return `${tabs.length} tabs: ${tabs.join(", ")} · ${range} ${partName}s each`;
}

export function describeTemplate(template: TemplateDefinition): string {
  let summary = cache.get(template.id);
  if (!summary) {
    summary = summarizeDiagram(template.build());
    cache.set(template.id, summary);
  }
  return describeSummary(summary);
}
