import { blankTemplate } from "./blank";
import { l0ArchitectureTemplate } from "./l0-architecture";
import type { TemplateDefinition } from "./types";

export const templates: TemplateDefinition[] = [blankTemplate, l0ArchitectureTemplate];

export function getTemplate(id: string): TemplateDefinition | undefined {
  return templates.find((template) => template.id === id);
}

export type { TemplateDefinition };
