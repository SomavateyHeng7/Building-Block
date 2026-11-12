import { create } from "zustand";
import { useDiagramStore } from "@/lib/diagram/store";
import { L1_CONTEXT_LABEL } from "@/lib/diagram/features/levelTools";
import { toast } from "@/lib/editor/toast";
import { selectSequenceItem } from "../sequence/sequenceSelection";

/**
 * Asks the canvas to bring something into view. Going to another tab or internal design remounts the canvas,
 * so the request waits here until the canvas showing it has measured its nodes (see Canvas).
 */
export type FocusTarget = { kind: "node" | "edge"; id: string } | { kind: "nodes"; ids: string[] };

/** Something on a sequence tab: a participant, message or note. */
export type Place = { sectionId: string; detailId?: string; kind: "node" | "edge" | "sequence"; id: string };

export const useCanvasFocus = create<{ target: FocusTarget | null; clear: () => void }>()((set) => ({
  target: null,
  clear: () => set({ target: null }),
}));

/** Zooms the canvas on screen to these boxes (say, ones just added or selected), once they're drawn. */
export function focusNodes(ids: string[]) {
  if (ids.length) useCanvasFocus.setState({ target: { kind: "nodes", ids } });
}

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

/**
 * Inside an internal design: adds the component's L1 neighbours it doesn't show yet, then zooms to them and says
 * what happened, so the new boxes are never added somewhere off-screen without a word.
 */
export function addL1ContextAndShow() {
  const store = useDiagramStore.getState();
  const added = store.addL1Context();
  if (!added) {
    toast.info("Every L1 neighbour is already drawn here");
    return;
  }
  focusNodes(useDiagramStore.getState().selectedNodeIds);
  toast.success(`Added ${added} L1 neighbour${added === 1 ? "" : "s"}`, {
    description: `They're in “${L1_CONTEXT_LABEL}”. Drag from a dot on an inner component to connect it to one.`,
    action: { label: "Undo", onClick: () => useDiagramStore.getState().undo() },
  });
}
