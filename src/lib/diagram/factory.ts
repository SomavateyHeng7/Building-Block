import { DEFAULT_LEGEND } from "./defaultLegend";
import type { Diagram, DiagramSection } from "./types";

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** The name a component or container gets when its name is left blank. */
export function defaultLabel(type: "container" | "block"): string {
  return type === "container" ? "Untitled Container" : "Untitled";
}

export function createBlankSection(name = "Section 1", kind: DiagramSection["kind"] = "architecture"): DiagramSection {
  const section = { id: createId("section"), name, nodes: [] };
  return kind === "sequence" ? { ...section, kind, sequence: { participants: [], steps: [] } } : section;
}

/** Sequence tabs hold a sequence diagram instead of boxes and connections. */
export function isSequenceSection(section: Pick<DiagramSection, "kind">): boolean {
  return section.kind === "sequence";
}

export function createBlankDiagram(name = "Untitled Diagram"): Diagram {
  const section = createBlankSection();
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: createId("diagram"),
    name,
    legend: DEFAULT_LEGEND.map((entry) => ({ ...entry })),
    sections: [section],
    activeSectionId: section.id,
    createdAt: now,
    updatedAt: now,
  };
}
