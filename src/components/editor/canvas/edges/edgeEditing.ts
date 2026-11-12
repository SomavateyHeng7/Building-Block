import { create } from "zustand";

/**
 * The connection whose caption is being typed on the canvas (double-click it, or Enter with it selected). Kept
 * outside the diagram: it's what's on screen, not part of the file, and not an undo step.
 */
export const useEdgeEditing = create<{ id: string | null }>()(() => ({ id: null }));

export function startEditingEdge(id: string) {
  useEdgeEditing.setState({ id });
}

export function stopEditingEdge() {
  useEdgeEditing.setState({ id: null });
}
