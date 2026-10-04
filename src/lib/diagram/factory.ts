import { DEFAULT_LEGEND } from "./defaultLegend";
import type { Diagram, DiagramSection } from "./types";

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createBlankSection(name = "Section 1"): DiagramSection {
  return { id: createId("section"), name, nodes: [] };
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
