import { c4ContextTemplate } from "./library/c4-context";
import { ciCdPipelineTemplate } from "./library/ci-cd-pipeline";
import { erDataModelTemplate } from "./library/er-data-model";
import { incidentEscalationTemplate } from "./library/incident-escalation";
import { securityZonesTemplate } from "./library/security-zones";
import { sequenceLoginTemplate } from "./library/sequence-login";
import { cloudLandingZoneTemplate } from "./library/cloud-landing-zone";
import { dataPipelineTemplate } from "./library/data-pipeline";
import { migrationRoadmapTemplate } from "./library/migration-roadmap";
import { orgChartTemplate } from "./library/org-chart";
import { blankTemplate } from "./library/blank";
import { crossFunctionalTemplate } from "./library/cross-functional";
import { currentVsTargetTemplate } from "./library/current-vs-target";
import { dataPlatformTemplate } from "./library/data-platform";
import { eventDrivenTemplate } from "./library/event-driven";
import { flowchartTemplate } from "./library/flowchart";
import { l0ArchitectureTemplate } from "./library/l0-architecture";
import { sequenceTemplate } from "./library/sequence";
import { serverlessTemplate } from "./library/serverless";
import { threeTierTemplate } from "./library/three-tier";
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
