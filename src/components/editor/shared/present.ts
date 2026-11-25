import { exportViews, type ExportView } from "@/lib/diagram/export/exportPlan";
import { useDiagramStore } from "@/lib/diagram/store";
import type { Diagram } from "@/lib/diagram/types";

/** What a presentation steps through: every tab and internal design that has something in it, in order. */
export function presentSteps(diagram: Diagram): ExportView[] {
  return exportViews(diagram).filter((view) => view.nodeCount > 0);
}

/** Where the open view sits among the steps, or -1 when it's an empty one. */
export function currentStepIndex(diagram: Diagram, steps = presentSteps(diagram)): number {
  return steps.findIndex((step) => step.sectionId === diagram.activeSectionId && step.componentId === diagram.activeDetailId);
}

/** Opens a step. Moving between views is navigation, so it isn't an edit and can't be undone or saved. */
export function goToStep(step: ExportView): void {
  const store = useDiagramStore.getState();
  store.setActiveSection(step.sectionId);
  if (step.componentId) store.openDetail(step.componentId);
}

/**
 * Moves the presentation forward or back by `delta` steps, stopping at the ends. From an empty view, forward goes
 * to the first step and back to the last.
 */
export function stepPresentation(delta: number): void {
  const { diagram } = useDiagramStore.getState();
  const steps = presentSteps(diagram);
  if (!steps.length) return;
  const index = currentStepIndex(diagram, steps);
  const next = index < 0 ? (delta > 0 ? 0 : steps.length - 1) : Math.min(Math.max(index + delta, 0), steps.length - 1);
  if (next !== index) goToStep(steps[next]);
}
