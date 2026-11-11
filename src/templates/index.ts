import { c4ContextTemplate } from "./c4-context";
import { ciCdPipelineTemplate } from "./ci-cd-pipeline";
import { erDataModelTemplate } from "./er-data-model";
import { incidentEscalationTemplate } from "./incident-escalation";
import { securityZonesTemplate } from "./security-zones";
import { sequenceLoginTemplate } from "./sequence-login";
import { cloudLandingZoneTemplate } from "./cloud-landing-zone";
import { dataPipelineTemplate } from "./data-pipeline";
import { migrationRoadmapTemplate } from "./migration-roadmap";
import { orgChartTemplate } from "./org-chart";
import { blankTemplate } from "./blank";
import { crossFunctionalTemplate } from "./cross-functional";
import { currentVsTargetTemplate } from "./current-vs-target";
import { dataPlatformTemplate } from "./data-platform";
import { eventDrivenTemplate } from "./event-driven";
import { flowchartTemplate } from "./flowchart";
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
  crossFunctionalTemplate,
  serverlessTemplate,
  dataPlatformTemplate,
  flowchartTemplate,
  { ...currentVsTargetTemplate, hidden: true },
  sequenceTemplate,
  c4ContextTemplate,
  dataPipelineTemplate,
  cloudLandingZoneTemplate,
  migrationRoadmapTemplate,
  incidentEscalationTemplate,
  ciCdPipelineTemplate,
  securityZonesTemplate,
  erDataModelTemplate,
  sequenceLoginTemplate,
  orgChartTemplate,
];

/** The templates offered on the start page and /templates. */
export const templates: TemplateDefinition[] = allTemplates.filter((template) => !template.hidden);

export function getTemplate(id: string): TemplateDefinition | undefined {
  return allTemplates.find((template) => template.id === id);
}

export { TEMPLATE_CATEGORIES } from "./types";
export type { Orientation, TemplateCategory, TemplateDefinition, TemplateOptions } from "./types";

export { filterTemplates, templatesSearch } from "./filter";
export { describeSummary, describeTemplate, summarizeDiagram } from "./summary";
