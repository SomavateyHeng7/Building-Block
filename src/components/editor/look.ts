import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";

/** Whether the canvas on screen is drawn in draw.io's look (see `SectionLook`). */
export function useDrawioLook(): boolean {
  return useDiagramStore((state) => getActiveSection(state.diagram).look === "drawio");
}
