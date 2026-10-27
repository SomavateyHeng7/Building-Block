import { blankTemplate } from "./blank";
import { currentVsTargetTemplate } from "./current-vs-target";
import { dataPlatformTemplate } from "./data-platform";
import { eventDrivenTemplate } from "./event-driven";
import { l0ArchitectureTemplate } from "./l0-architecture";
import { sequenceTemplate } from "./sequence";
import { serverlessTemplate } from "./serverless";
import { threeTierTemplate } from "./three-tier";
import type { TemplateDefinition } from "./types";

/** Every template, hidden ones included (they still build, and are tested). */
export const allTemplates: TemplateDefinition[] = [
  blankTemplate,
  l0ArchitectureTemplate,
  threeTierTemplate,
  eventDrivenTemplate,
  serverlessTemplate,
  dataPlatformTemplate,
  { ...currentVsTargetTemplate, hidden: true },
  sequenceTemplate,
];

/** The templates offered on the start page and /templates. */
export const templates: TemplateDefinition[] = allTemplates.filter((template) => !template.hidden);

export function getTemplate(id: string): TemplateDefinition | undefined {
  return allTemplates.find((template) => template.id === id);
}

export type { TemplateDefinition };
