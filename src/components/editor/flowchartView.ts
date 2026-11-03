import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import type { DiagramNode } from "@/lib/diagram/types";

// Worked out once per nodes array (every edit makes a new one), so each box asking costs nothing on big diagrams.
const cache = new WeakMap<readonly DiagramNode[], boolean>();

/** Whether a view is a flowchart: it has a component drawn as a flowchart shape (a decision, a pill…). */
export function isFlowchart(nodes: readonly DiagramNode[]): boolean {
  let flowchart = cache.get(nodes);
  if (flowchart === undefined) {
    flowchart = nodes.some((node) => node.data.kind === "block" && node.data.shape !== undefined);
    cache.set(nodes, flowchart);
  }
  return flowchart;
}

/**
 * Whether the view on screen is a flowchart, where shapes offer draw.io's quick-add arrows. Architecture tabs (no
 * flowchart shapes) don't show them, so editing an L0 diagram is unchanged.
 */
export function useIsFlowchart(): boolean {
  return useDiagramStore((state) => isFlowchart(getActiveSection(state.diagram).nodes));
}
