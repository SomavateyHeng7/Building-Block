import { create } from "zustand";
import { useDiagramStore } from "@/lib/diagram/store";
import { selectSequenceItem } from "./sequenceSelection";

/**
 * Asks the canvas to bring something into view. Going to another tab or internal design remounts the canvas,
 * so the request waits here until the canvas showing it has measured its nodes (see Canvas).
 */
export type FocusTarget = { kind: "node" | "edge"; id: string };

/** Something on a sequence tab: a participant, message or note. */
export type Place = { sectionId: string; detailId?: string; kind: FocusTarget["kind"] | "sequence"; id: string };

export const useCanvasFocus = create<{ target: FocusTarget | null; clear: () => void }>()((set) => ({
  target: null,
  clear: () => set({ target: null }),
}));

/**
 * Opens the tab (and internal design) something is on, selects it and zooms to it; on a sequence tab, selects it
 * and scrolls it into view.
 */
export function goTo(place: Place) {
  const store = useDiagramStore.getState();
  store.setActiveSection(place.sectionId);
  if (place.kind === "sequence") {
    selectSequenceItem(place.id);
    // The sequence tab renders on the next frames.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-participant="${CSS.escape(place.id)}"], [data-step="${CSS.escape(place.id)}"]`)
          ?.scrollIntoView({ block: "center", inline: "center" }),
      ),
    );
    return;
  }
  if (place.detailId) store.openDetail(place.detailId);
  if (place.kind === "edge") store.setSelectedEdge(place.id);
  else store.setSelection([place.id]);
  useCanvasFocus.setState({ target: { kind: place.kind, id: place.id } });
}
