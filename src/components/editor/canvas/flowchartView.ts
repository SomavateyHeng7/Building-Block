import { isFlowchart } from "@/lib/diagram/shapes";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";

/**
 * Whether the view on screen is a flowchart (`isFlowchart`), where shapes offer draw.io's quick-add arrows.
 * Architecture tabs (no flowchart shapes) don't show them, so editing an L0 diagram is unchanged.
 */
export function useIsFlowchart(): boolean {
  return useDiagramStore((state) => isFlowchart(getActiveSection(state.diagram).nodes));
}
