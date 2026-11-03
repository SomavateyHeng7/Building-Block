import { c4ContextTemplate } from "./c4-context";
import { cloudLandingZoneTemplate } from "./cloud-landing-zone";
import { dataPipelineTemplate } from "./data-pipeline";
import { migrationRoadmapTemplate } from "./migration-roadmap";
import { blankTemplate } from "./blank";
import { crossFunctionalTemplate } from "./cross-functional";
import { currentVsTargetTemplate } from "./current-vs-target";
import { eventDrivenTemplate } from "./event-driven";
import { l0ArchitectureTemplate } from "./l0-architecture";
import { sequenceTemplate } from "./sequence";
import { threeTierTemplate } from "./three-tier";
import type { TemplateDefinition } from "./types";

export const templates: TemplateDefinition[] = [
  blankTemplate,
  l0ArchitectureTemplate,
  threeTierTemplate,
  eventDrivenTemplate,
  currentVsTargetTemplate,
  crossFunctionalTemplate,
  sequenceTemplate,
  c4ContextTemplate,
  dataPipelineTemplate,
  cloudLandingZoneTemplate,
  migrationRoadmapTemplate,
];

export function getTemplate(id: string): TemplateDefinition | undefined {
  return templates.find((template) => template.id === id);
}

export { TEMPLATE_CATEGORIES } from "./types";
export type { Orientation, TemplateCategory, TemplateDefinition, TemplateOptions } from "./types";

export { filterTemplates } from "./filter";
