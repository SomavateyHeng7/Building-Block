import { startDiagram } from "@/lib/diagram/persistence/file";
import { recordRecentTemplate } from "@/lib/editor/recentTemplates";
import { useCompareView } from "@/components/editor/shared/compareView";
import type { TemplateDefinition, TemplateOptions } from "@/templates";

/**
 * Opens a template as a new diagram and remembers it as recently used. A template that says which tabs to
 * compare (`compare`, by tab name) opens with the differences already marked.
 */
export function startFromTemplate(template: TemplateDefinition, options?: TemplateOptions): void {
  const diagram = template.build(options);
  startDiagram(diagram);
  recordRecentTemplate(template.id);
  const from = diagram.sections.find((section) => section.name === template.compare?.from);
  const to = diagram.sections.find((section) => section.name === template.compare?.to);
  if (from && to) useCompareView.getState().show({ diagramId: diagram.id, fromId: from.id, toId: to.id });
}
