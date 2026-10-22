import { create } from "zustand";
import { useDiagramStore } from "@/lib/diagram/store";

/**
 * Asks the canvas to bring something into view. Going to another tab or internal design remounts the canvas,
 * so the request waits here until the canvas showing it has measured its nodes (see Canvas).
 */
export type FocusTarget = { kind: "node" | "edge"; id: string };

export const useCanvasFocus = create<{ target: FocusTarget | null; clear: () => void }>()((set) => ({
  target: null,
  clear: () => set({ target: null }),
}));

/** Opens the tab (and internal design) something is on, selects it and zooms to it. */
export function goTo(place: { sectionId: string; detailId?: string } & FocusTarget) {
  const store = useDiagramStore.getState();
  store.setActiveSection(place.sectionId);
  if (place.detailId) store.openDetail(place.detailId);
  if (place.kind === "edge") store.setSelectedEdge(place.id);
  else store.setSelection([place.id]);
  useCanvasFocus.setState({ target: { kind: place.kind, id: place.id } });
}
